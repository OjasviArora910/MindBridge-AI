"""Small helpers shared by routers."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import User


def get_owned(db: Session, model, item_id: int, user: User):
    """Fetch a row only if it belongs to `user`. Missing and foreign rows look identical (404)."""
    obj = db.get(model, item_id)
    if obj is None or obj.user_id != user.id:
        raise HTTPException(404, "Not found.")
    return obj
