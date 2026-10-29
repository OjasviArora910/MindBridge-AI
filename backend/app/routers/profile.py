"""Onboarding and user preferences."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai.personalization import welcome_message
from ..db import get_db
from ..deps import current_user
from ..models import Onboarding, User
from ..schemas import OnboardingIn, OnboardingOut, PreferencesIn, PreferencesOut

router = APIRouter(tags=["profile"])


@router.get("/onboarding", response_model=OnboardingOut | None)
def get_onboarding(user: User = Depends(current_user), db: Session = Depends(get_db)):
    ob = db.scalar(select(Onboarding).where(Onboarding.user_id == user.id))
    if ob is None:
        return None
    return OnboardingOut(
        saved=True,
        stress_level=ob.stress_level,
        feelings=ob.feelings or [],
        main_concern=ob.main_concern,
        duration=ob.duration,
        welcome_message=welcome_message(ob),
    )


@router.put("/onboarding", response_model=OnboardingOut)
def save_onboarding(body: OnboardingIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Create or edit onboarding answers. Answers are persisted only if `consent_to_save` is true."""
    ob = db.scalar(select(Onboarding).where(Onboarding.user_id == user.id))
    candidate = Onboarding(
        user_id=user.id,
        stress_level=body.stress_level,
        feelings=list(body.feelings),
        main_concern=body.main_concern,
        duration=body.duration,
    )
    if body.consent_to_save:
        if ob is None:
            ob = candidate
            db.add(ob)
        else:
            ob.stress_level, ob.feelings = candidate.stress_level, candidate.feelings
            ob.main_concern, ob.duration = candidate.main_concern, candidate.duration
    user.onboarding_complete = True
    db.commit()
    return OnboardingOut(
        saved=body.consent_to_save,
        stress_level=body.stress_level,
        feelings=list(body.feelings),
        main_concern=body.main_concern,
        duration=body.duration,
        welcome_message=welcome_message(candidate),
    )


@router.get("/preferences", response_model=PreferencesOut)
def get_preferences(user: User = Depends(current_user)):
    return user


@router.patch("/preferences", response_model=PreferencesOut)
def update_preferences(body: PreferencesIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    return user
