"""Self-assessment endpoints. Returns nothing fabricated: unregistered instruments are 'planned' only."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import assessments as reg
from ..ai import safety
from ..db import get_db
from ..deps import current_user
from ..models import AssessmentAttempt, User
from ..schemas import AttemptIn

router = APIRouter(prefix="/assessments", tags=["assessments"])


@router.get("")
def list_assessments(user: User = Depends(current_user)):
    return {
        "available": [{"id": i.id, "title": i.title, "source": i.source, "reviewed": i.reviewed} for i in reg.REGISTRY.values()],
        "planned": [{**p, "status": "unavailable", "reason": reg.PLANNED_REASON} for p in reg.PLANNED
                    if p["id"] not in reg.REGISTRY],
        "disclaimer": reg.RESULT_DISCLAIMER,
    }


@router.get("/{instrument_id}")
def get_assessment(instrument_id: str, user: User = Depends(current_user)):
    inst = reg.REGISTRY.get(instrument_id)
    if inst is None:
        raise HTTPException(404, "This questionnaire isn't available.")
    return {"id": inst.id, "title": inst.title, "source": inst.source, "stem": inst.stem, "reviewed": inst.reviewed,
            "items": inst.items, "options": inst.options}


@router.post("/{instrument_id}/attempts")
def submit_attempt(
    instrument_id: str, body: AttemptIn, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    inst = reg.REGISTRY.get(instrument_id)
    if inst is None:
        raise HTTPException(404, "This questionnaire isn't available.")
    if len(body.answers) != len(inst.items) or any(a < 0 or a >= len(inst.options) for a in body.answers):
        raise HTTPException(422, "Please answer every question with one of the listed options.")

    db.add(AssessmentAttempt(user_id=user.id, instrument_id=inst.id, answers=body.answers))
    db.commit()

    flagged = reg.risk_flagged(inst, body.answers)
    result = inst.score(body.answers)  # from the authorised scoring only
    if flagged:
        safety_block = {"level": "urgent", "show_resources": True, "message": safety._build("urgent", "self_harm").response,
                        "resources": safety.load_resources(user.region)}
    elif result.get("show_support"):
        safety_block = {"level": "support", "show_resources": True, "message": None,
                        "resources": safety.load_resources(user.region)}
    else:
        safety_block = None
    return {
        "instrument": inst.id,
        "questionnaire_result": result,
        "reviewed": inst.reviewed,
        "disclaimer": reg.RESULT_DISCLAIMER,
        "ai_observations": None,  # kept separate from questionnaire results; none generated here
        "safety": safety_block,
    }
