"""Privacy controls: see what is stored, export it, delete saved context, delete everything."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import (AssessmentAttempt, Conversation, MoodEntry, Onboarding, ReportRecord, ThoughtEntry,
                      User)
from ..schemas import MoodOut, ThoughtOut

router = APIRouter(prefix="/data", tags=["data"])


@router.get("/context")
def stored_context(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Exactly what personalisation can draw on, so the user can review and remove it."""
    ob = db.scalar(select(Onboarding).where(Onboarding.user_id == user.id))
    since = date.today() - timedelta(days=7)
    recent = db.scalars(select(MoodEntry).where(MoodEntry.user_id == user.id, MoodEntry.entry_date >= since)).all()
    return {
        "personalization_enabled": user.personalization_enabled,
        "onboarding": None if ob is None else {
            "stress_level": ob.stress_level, "feelings": ob.feelings,
            "main_concern": ob.main_concern, "duration": ob.duration,
        },
        "recent_mood_checkins_used": len(recent) if user.personalization_enabled else 0,
        "chat_history_saved": user.save_chat_history,
        "note": "No diagnoses or psychological profiles are stored or inferred.",
    }


@router.delete("/context", status_code=204)
def delete_context(user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(delete(Onboarding).where(Onboarding.user_id == user.id))
    db.commit()


@router.get("/export")
def export_all(user: User = Depends(current_user), db: Session = Depends(get_db)):
    ob = db.scalar(select(Onboarding).where(Onboarding.user_id == user.id))
    convs = db.scalars(select(Conversation).where(Conversation.user_id == user.id)).all()
    moods = db.scalars(select(MoodEntry).where(MoodEntry.user_id == user.id)).all()
    thoughts = db.scalars(select(ThoughtEntry).where(ThoughtEntry.user_id == user.id)).all()
    attempts = db.scalars(select(AssessmentAttempt).where(AssessmentAttempt.user_id == user.id)).all()
    return {
        "account": {"email": user.email, "is_guest": user.is_guest, "created_at": user.created_at.isoformat()},
        "preferences": {
            "save_chat_history": user.save_chat_history, "personalization_enabled": user.personalization_enabled,
            "share_with_ai_provider": user.share_with_ai_provider, "response_length": user.response_length,
            "language": user.language, "region": user.region,
        },
        "onboarding": None if ob is None else {
            "stress_level": ob.stress_level, "feelings": ob.feelings,
            "main_concern": ob.main_concern, "duration": ob.duration,
        },
        "mood_entries": [MoodOut.model_validate(m).model_dump(mode="json") for m in moods],
        "thought_entries": [ThoughtOut.model_validate(t).model_dump(mode="json") for t in thoughts],
        "conversations": [
            {"id": c.id, "created_at": c.created_at.isoformat(),
             "messages": [{"role": m.role, "content": m.content, "at": m.created_at.isoformat()} for m in c.messages]}
            for c in convs
        ],
        "assessment_attempts": [{"instrument": a.instrument_id, "answers": a.answers} for a in attempts],
    }


@router.delete("/all", status_code=204)
def delete_account(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Permanently removes the account and everything attached to it."""
    for model in (Conversation, MoodEntry, ThoughtEntry, AssessmentAttempt, ReportRecord, Onboarding):
        for row in db.scalars(select(model).where(model.user_id == user.id)).all():
            db.delete(row)  # per-row delete so ORM cascades (conversation -> messages) apply
    db.delete(user)
    db.commit()
