"""Dashboard summary: small, neutral, and built only from the user's stored entries."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import MoodEntry, Onboarding, ThoughtEntry, User
from ..schemas import MoodOut, ThoughtOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

STARTERS = {
    "studies": ["Talk about expectations", "Write a thought in the diary", "Make one small plan for today"],
    "family_relationships": ["Talk it through", "Write a thought in the diary", "Try a grounding exercise"],
    "work_future": ["Separate facts from predictions", "Break one worry into smaller steps", "Take a short pause"],
    "personal_expectations": ["Explore a thought together", "Write it in the diary", "Pick one small thing for today"],
    "several": ["Sort what's on your mind", "Pick one thing to set down today", "Try a grounding exercise"],
}


def summaries(entries: list[MoodEntry]) -> list[str]:
    """Neutral, non-causal sentences. We describe what was logged, never why."""
    out: list[str] = []
    if not entries:
        return out
    out.append(f"You logged {len(entries)} check-in{'s' if len(entries) != 1 else ''} in the last 7 days.")
    low = sum(1 for e in entries if e.mood_rating <= 4)
    if low >= 3:
        out.append("You reported feeling low on several days this week.")
    elif low:
        out.append(f"You reported a low rating on {low} day{'s' if low != 1 else ''} this week.")
    sleep = [e.sleep_hours for e in entries if e.sleep_hours is not None]
    if sleep:
        out.append(f"Your logged sleep averaged {sum(sleep) / len(sleep):.1f} hours.")
    return out


@router.get("")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    today = date.today()
    since = today - timedelta(days=29)
    entries = db.scalars(
        select(MoodEntry).where(MoodEntry.user_id == user.id, MoodEntry.entry_date >= since).order_by(MoodEntry.entry_date)
    ).all()
    week = [e for e in entries if e.entry_date >= today - timedelta(days=6)]
    today_entry = next((e for e in entries if e.entry_date == today), None)
    recent = db.scalars(
        select(ThoughtEntry).where(ThoughtEntry.user_id == user.id).order_by(ThoughtEntry.id.desc()).limit(3)
    ).all()
    ob = db.scalar(select(Onboarding).where(Onboarding.user_id == user.id))
    starters = STARTERS.get(ob.main_concern, []) if (ob and user.personalization_enabled) else []
    return {
        "today": MoodOut.model_validate(today_entry).model_dump(mode="json") if today_entry else None,
        "series": [
            {"date": e.entry_date.isoformat(), "mood": e.mood_rating, "sleep_hours": e.sleep_hours,
             "sleep_quality": e.sleep_quality}
            for e in entries
        ],
        "summaries": summaries(week),
        "recent_thoughts": [ThoughtOut.model_validate(t).model_dump(mode="json") for t in recent],
        "suggested_starts": starters,
        "has_data": bool(entries),
    }
