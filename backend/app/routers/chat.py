"""Emotional-support chat. The safety workflow runs first and can bypass the model."""
import logging
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai import safety
from ..ai.llm import LLMUnavailable, get_provider
from ..ai.personalization import build_context, length_instruction, welcome_message
from ..ai.prompts import PROMPT_VERSION, load_system_prompt
from ..config import get_settings
from ..db import get_db
from ..deps import current_user
from ..models import Conversation, Message, Onboarding, User
from ..schemas import ChatIn, ChatOut, ConversationOut, SafetyInfo, SuggestedAction

router = APIRouter(prefix="/chat", tags=["chat"])
log = logging.getLogger("mindbridge.chat")  # never log message text

FALLBACK_UNAVAILABLE = (
    "I can't put a reply together right now. This is a problem on our side, not something you did. "
    "Your mood tracker, thought diary and SOS exercises still work. "
    "If you're struggling, the support options are always available from the menu."
)
FALLBACK_NEEDS_CONSENT = (
    "AI replies are switched off until you allow sharing your messages with the AI provider in Settings & Privacy. "
    "Your other tools still work."
)
FALLBACK_GUARDED = (
    "I wasn't able to put together a reply I'm comfortable giving. "
    "Could you tell me a little more about what's on your mind, in your own words?"
)

_recent: dict[int, deque] = defaultdict(deque)  # prototype in-memory rate limiter


def _rate_limit(user_id: int) -> None:
    limit = get_settings().chat_rate_limit_per_minute
    now = time.time()
    window = _recent[user_id]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= limit:
        raise HTTPException(429, "You're sending messages quickly. Take a breath and try again in a minute.")
    window.append(now)


def _suggestions(text: str) -> list[SuggestedAction]:
    """Only suggest tools when the user asked for them."""
    t = text.lower()
    out: list[SuggestedAction] = []
    if any(w in t for w in ["calming exercise", "breathing", "calm down", "calming"]):
        out.append(SuggestedAction(type="sos", id="breathing", label="Paced breathing"))
        out.append(SuggestedAction(type="sos", id="grounding", label="5-4-3-2-1 grounding"))
    if any(w in t for w in ["organize my thoughts", "organise my thoughts", "thought diary", "write it down"]):
        out.append(SuggestedAction(type="diary", label="Open the thought diary"))
    return out


def _prior_level(history: list[dict]) -> str:
    worst = "none"
    for m in history[-6:]:
        if m["role"] == "user":
            level = safety.classify(m["content"]).level
            if safety._RANK[level] > safety._RANK[worst]:
                worst = level
    return worst


@router.get("/welcome")
def welcome(user: User = Depends(current_user), db: Session = Depends(get_db)):
    ob = db.scalar(select(Onboarding).where(Onboarding.user_id == user.id)) if user.personalization_enabled else None
    return {"message": welcome_message(ob), "ai_generated": False, "prompt_version": PROMPT_VERSION}


@router.post("", response_model=ChatOut)
def send_message(body: ChatIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _rate_limit(user.id)
    provider = get_provider()

    # --- conversation & history ---
    conv: Conversation | None = None
    if body.conversation_id is not None:  # ownership is checked whether or not saving is on
        owned = db.get(Conversation, body.conversation_id)
        if owned is None or owned.user_id != user.id:
            raise HTTPException(404, "Not found.")
    if user.save_chat_history:
        if body.conversation_id is not None:
            conv = owned
        else:
            conv = Conversation(user_id=user.id)
            db.add(conv)
            db.flush()
        history = [{"role": m.role, "content": m.content} for m in conv.messages[-10:]]
    else:
        history = [h.model_dump() for h in body.history[-10:]]

    # --- safety first: rules on the raw message, before any model call ---
    result = safety.classify(body.message, _prior_level(history))
    resources = safety.load_resources(user.region) if result.show_resources else None
    log.info("chat_turn user=%s safety=%s category=%s", user.id, result.level, result.category)

    ai_generated, ai_available = True, True
    if result.bypass_llm:
        reply, ai_generated = result.response or "", False
    elif not provider.is_mock and not user.share_with_ai_provider:
        reply, ai_generated, ai_available = FALLBACK_NEEDS_CONSENT, False, False
    else:
        system = "\n\n".join(
            part
            for part in [
                load_system_prompt(),
                length_instruction(user.response_length),
                build_context(db, user),
                safety.DISTRESS_GUIDANCE if result.level == "distress" else "",
            ]
            if part
        )
        messages = [*history, {"role": "user", "content": body.message}]
        try:
            reply = provider.generate(system, messages)
            ok, reason = safety.guard_output(reply)
            if not ok:
                log.warning("output_guard_blocked reason=%s", reason)
                reply, ai_generated = FALLBACK_GUARDED, False
        except LLMUnavailable as exc:
            log.warning("llm_unavailable reason=%s", exc)
            reply, ai_generated, ai_available = FALLBACK_UNAVAILABLE, False, False

    # --- persistence (only with consent). Fallback text is not stored as a conversation turn. ---
    if conv is not None:
        db.add(Message(conversation_id=conv.id, role="user", content=body.message, safety_level=result.level))
        if ai_available:
            db.add(Message(conversation_id=conv.id, role="assistant", content=reply, safety_level=result.level))
        db.commit()

    return ChatOut(
        conversation_id=conv.id if conv else None,
        reply=reply,
        ai_generated=ai_generated,
        ai_available=ai_available,
        mock_mode=provider.is_mock and not result.bypass_llm,
        safety=SafetyInfo(level=result.level, category=result.category, show_resources=result.show_resources),
        suggestions=_suggestions(body.message) if result.level == "none" else [],
        resources=resources,
    )


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Conversation).where(Conversation.user_id == user.id).order_by(Conversation.id.desc()).limit(20)
    ).all()
    return rows


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    conv = db.get(Conversation, conversation_id)
    if conv is None or conv.user_id != user.id:
        raise HTTPException(404, "Not found.")
    return conv


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    conv = db.get(Conversation, conversation_id)
    if conv is None or conv.user_id != user.id:
        raise HTTPException(404, "Not found.")
    db.delete(conv)
    db.commit()


@router.delete("/conversations", status_code=204)
def delete_all_conversations(user: User = Depends(current_user), db: Session = Depends(get_db)):
    for conv in db.scalars(select(Conversation).where(Conversation.user_id == user.id)).all():
        db.delete(conv)
    db.commit()
