from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


class PushTokenUpdate(BaseModel):
    expo_push_token: str


@router.get("/me", response_model=UserOut)
async def get_my_profile(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user


@router.patch("/me/push-token", response_model=UserOut)
async def update_push_token(
    data: PushTokenUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """La app móvil llama esto al iniciar sesión (o al abrir la app) para que el
    backend sepa a qué dispositivo enviarle notificaciones push."""
    current_user.expo_push_token = data.expo_push_token
    await db.commit()
    await db.refresh(current_user)
    return current_user
