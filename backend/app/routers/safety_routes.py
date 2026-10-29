"""Support resources. Public on purpose: help must never sit behind a login."""
from fastapi import APIRouter

from ..ai import safety

router = APIRouter(prefix="/safety", tags=["safety"])


@router.get("/resources")
def resources(region: str | None = None):
    data = safety.load_resources(region)
    data["disclaimer"] = (
        "MindBridge AI is not an emergency service and cannot contact anyone for you. "
        "If you are in immediate danger, contact your local emergency number."
    )
    return data
