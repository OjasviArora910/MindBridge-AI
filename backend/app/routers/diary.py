"""CBT-inspired thought diary. Optional AI suggestions; the diary itself works offline."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai import safety
from ..ai.llm import LLMUnavailable, get_provider
from ..db import get_db
from ..deps import current_user
from ..models import ThoughtEntry, User
from ..schemas import SuggestIn, SuggestOut, ThoughtIn, ThoughtOut
from .common import get_owned

router = APIRouter(prefix="/diary", tags=["diary"])
log = logging.getLogger("mindbridge.diary")

_MOCK_PERSPECTIVES = [
    "What might you say to a close friend who had this exact thought?",
    "Is there another explanation for what happened that is also possible?",
    "Is there anything that doesn't quite fit this thought, even something small?",
    "If this thought were only a prediction, what else could happen?",
]


@router.post("", response_model=ThoughtOut, status_code=201)
def create_entry(body: ThoughtIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    entry = ThoughtEntry(user_id=user.id, **body.model_dump())
    db.add(entry)
    db.commit()
    return entry


@router.get("", response_model=list[ThoughtOut])
def list_entries(user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = select(ThoughtEntry).where(ThoughtEntry.user_id == user.id).order_by(ThoughtEntry.id.desc()).limit(200)
    return db.scalars(q).all()


@router.post("/suggest", response_model=SuggestOut)
def suggest(body: SuggestIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Optional help finding alternative perspectives. Always presented as possibilities."""
    # Safety rules apply here too: diary text can contain risk language.
    result = safety.classify(f"{body.situation or ''} {body.automatic_thought}")
    if result.bypass_llm:
        return SuggestOut(
            suggestions=[],
            ai_generated=False,
            safety_message=result.response,
            resources=safety.load_resources(user.region),
        )

    provider = get_provider()
    if provider.is_mock:
        return SuggestOut(suggestions=_MOCK_PERSPECTIVES[:3], ai_generated=False, mock_mode=True)
    if not user.share_with_ai_provider:
        raise HTTPException(403, "Allow sharing with the AI provider in Settings & Privacy to use AI suggestions.")
    system = (
        "You help someone reflect on a difficult thought using CBT-inspired questions. Offer exactly three "
        "short alternative perspectives as possibilities, one per line, no numbering. Never say the thought is "
        "irrational or wrong. Never diagnose or give medical advice."
    )
    content = f"Situation: {body.situation or 'not given'}\nThought: {body.automatic_thought}"
    try:
        raw = provider.generate(system, [{"role": "user", "content": content}], max_tokens=250)
    except LLMUnavailable as exc:
        log.warning("diary_suggest_unavailable reason=%s", exc)
        raise HTTPException(503, "Suggestions aren't available right now. You can still write your own.") from exc
    ok, _ = safety.guard_output(raw)
    lines = [ln.strip("-• \t") for ln in raw.splitlines() if ln.strip()][:3]
    if not ok or not lines:
        raise HTTPException(503, "Suggestions aren't available right now. You can still write your own.")
    return SuggestOut(suggestions=lines)


@router.get("/{entry_id}", response_model=ThoughtOut)
def get_entry(entry_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return get_owned(db, ThoughtEntry, entry_id, user)


@router.put("/{entry_id}", response_model=ThoughtOut)
def update_entry(entry_id: int, body: ThoughtIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    entry = get_owned(db, ThoughtEntry, entry_id, user)
    for field, value in body.model_dump().items():
        setattr(entry, field, value)
    db.commit()
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(get_owned(db, ThoughtEntry, entry_id, user))
    db.commit()
