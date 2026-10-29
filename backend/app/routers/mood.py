"""Daily mood and sleep entries. Works without any LLM."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import MoodEntry, User
from ..schemas import MoodIn, MoodOut
from .common import get_owned

router = APIRouter(prefix="/mood", tags=["mood"])


@router.post("", response_model=MoodOut, status_code=201)
def create_entry(body: MoodIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    day = body.entry_date or date.today()
    if db.scalar(select(MoodEntry).where(MoodEntry.user_id == user.id, MoodEntry.entry_date == day)):
        raise HTTPException(409, "There's already a check-in for that day. You can edit it instead.")
    entry = MoodEntry(user_id=user.id, entry_date=day, **body.model_dump(exclude={"entry_date"}))
    db.add(entry)
    db.commit()
    return entry


@router.get("", response_model=list[MoodOut])
def list_entries(
    date_from: date | None = None,
    date_to: date | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    q = select(MoodEntry).where(MoodEntry.user_id == user.id)
    if date_from:
        q = q.where(MoodEntry.entry_date >= date_from)
    if date_to:
        q = q.where(MoodEntry.entry_date <= date_to)
    return db.scalars(q.order_by(MoodEntry.entry_date.desc()).limit(400)).all()


@router.get("/calendar")
def calendar(
    month: str = Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    year, mon = int(month[:4]), int(month[5:])
    start = date(year, mon, 1)
    end = date(year + (mon == 12), (mon % 12) + 1, 1) - timedelta(days=1)
    rows = db.scalars(
        select(MoodEntry).where(MoodEntry.user_id == user.id, MoodEntry.entry_date.between(start, end))
    ).all()
    return {
        "month": month,
        "days": {
            r.entry_date.isoformat(): {"id": r.id, "mood_rating": r.mood_rating, "sleep_hours": r.sleep_hours}
            for r in rows
        },
    }


@router.get("/{entry_id}", response_model=MoodOut)
def get_entry(entry_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return get_owned(db, MoodEntry, entry_id, user)


@router.put("/{entry_id}", response_model=MoodOut)
def update_entry(entry_id: int, body: MoodIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    entry = get_owned(db, MoodEntry, entry_id, user)
    new_day = body.entry_date or entry.entry_date
    clash = db.scalar(
        select(MoodEntry).where(
            MoodEntry.user_id == user.id, MoodEntry.entry_date == new_day, MoodEntry.id != entry.id
        )
    )
    if clash:
        raise HTTPException(409, "There's already a check-in for that day.")
    for field, value in body.model_dump(exclude={"entry_date"}).items():
        setattr(entry, field, value)
    entry.entry_date = new_day
    db.commit()
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(get_owned(db, MoodEntry, entry_id, user))
    db.commit()
