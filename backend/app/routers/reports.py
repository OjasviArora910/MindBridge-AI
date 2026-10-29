"""Personal self-reflection summary. Preview -> user edits/approves -> export.

Only the selected sections and non-excluded entries are included. Nothing is sent anywhere;
the exported text is returned to the user only. Only metadata (when, which sections, how many
entries) is stored, never the report text.
"""
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import MoodEntry, ReportRecord, ThoughtEntry, User
from ..schemas import ReportExportIn, ReportPreviewIn, ReportPreviewOut

router = APIRouter(prefix="/reports", tags=["reports"])

DISCLAIMER = (
    "PERSONAL SELF-REFLECTION SUMMARY\n"
    "Created by you with MindBridge AI. This is not a clinical report and does not contain a diagnosis. "
    "It only contains what you chose to include."
)


@router.post("/preview", response_model=ReportPreviewOut)
def preview(body: ReportPreviewIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    moods: list[MoodEntry] = []
    thoughts: list[ThoughtEntry] = []
    wants_mood = any(s in body.sections for s in ("mood", "sleep", "reflections"))

    if wants_mood:
        q = select(MoodEntry).where(MoodEntry.user_id == user.id).order_by(MoodEntry.entry_date)
        if body.date_from:
            q = q.where(MoodEntry.entry_date >= body.date_from)
        if body.date_to:
            q = q.where(MoodEntry.entry_date <= body.date_to)
        moods = [m for m in db.scalars(q).all() if m.id not in body.exclude_mood_ids]
    if "thoughts" in body.sections:
        thoughts = [
            t for t in db.scalars(
                select(ThoughtEntry).where(ThoughtEntry.user_id == user.id).order_by(ThoughtEntry.id)
            ).all()
            if t.id not in body.exclude_thought_ids
        ]

    lines = [DISCLAIMER, f"Prepared on {date.today().isoformat()}"]
    if body.date_from or body.date_to:
        lines.append(f"Period: {body.date_from or 'start'} to {body.date_to or 'today'}")
    lines.append("")

    if "mood" in body.sections:
        lines.append("MOOD CHECK-INS (your own 1-10 ratings; 10 = very good)")
        if moods:
            avg = sum(m.mood_rating for m in moods) / len(moods)
            lines.append(f"{len(moods)} check-in(s), average rating {avg:.1f}.")
            for m in moods:
                feelings = f" Feelings: {', '.join(m.feelings)}." if m.feelings else ""
                lines.append(f"- {m.entry_date}: {m.mood_rating}/10.{feelings}")
        else:
            lines.append("No check-ins in this selection.")
        lines.append("")

    if "sleep" in body.sections:
        lines.append("SLEEP LOG (as you recorded it)")
        sleeps = [m for m in moods if m.sleep_hours is not None or m.sleep_quality is not None]
        if sleeps:
            for m in sleeps:
                hours = f"{m.sleep_hours:g} h" if m.sleep_hours is not None else "hours not recorded"
                quality = f", quality {m.sleep_quality}/5" if m.sleep_quality is not None else ""
                lines.append(f"- {m.entry_date}: {hours}{quality}")
        else:
            lines.append("No sleep entries in this selection.")
        lines.append("")

    if "reflections" in body.sections:
        lines.append("PERSONAL NOTES")
        notes = [m for m in moods if m.note or m.triggers]
        if notes:
            for m in notes:
                if m.note:
                    lines.append(f"- {m.entry_date}: {m.note}")
                if m.triggers:
                    lines.append(f"  Things you noted around that day: {m.triggers}")
        else:
            lines.append("No notes in this selection.")
        lines.append("")

    if "thoughts" in body.sections:
        lines.append("THOUGHT DIARY ENTRIES")
        if thoughts:
            for t in thoughts:
                lines.append(f"- Entry from {t.created_at.date()}")
                for label, value in [
                    ("Situation", t.situation), ("Thought", t.automatic_thought), ("Emotion", t.emotion),
                    ("Intensity", f"{t.intensity}/10" if t.intensity is not None else None),
                    ("Evidence supporting the thought", t.evidence_for),
                    ("Evidence challenging the thought", t.evidence_against),
                    ("Another perspective", t.alternative), ("Next step", t.next_step),
                ]:
                    if value:
                        lines.append(f"    {label}: {value}")
        else:
            lines.append("No diary entries in this selection.")
        lines.append("")

    if "questions" in body.sections:
        lines.append("QUESTIONS I WANT TO EXPLORE")
        qs = [q.strip() for q in body.questions if q.strip()]
        lines.extend(f"- {q}" for q in qs) if qs else lines.append("None added.")
        lines.append("")

    return ReportPreviewOut(text="\n".join(lines).strip(), mood_ids=[m.id for m in moods],
                            thought_ids=[t.id for t in thoughts])


@router.post("/export")
def export(body: ReportExportIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Returns the user-approved text, always carrying the disclaimer. Not emailed or shared."""
    text = body.approved_text.strip()
    if not text.startswith("PERSONAL SELF-REFLECTION SUMMARY"):
        text = f"{DISCLAIMER}\n\n{text}"
    db.add(ReportRecord(user_id=user.id, sections=body.sections, entry_count=body.entry_count))
    db.commit()
    return {"filename": f"mindbridge-summary-{date.today().isoformat()}.txt", "text": text}
