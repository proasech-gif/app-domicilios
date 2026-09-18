import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.orders import _get_order_with_items, _authorize_view
from app.core.database import get_db
from app.models.chat import ChatMessage
from app.models.user import User
from app.schemas.chat import ChatMessageOut

router = APIRouter(prefix="/api/orders", tags=["chat"])


@router.get("/{order_id}/messages", response_model=list[ChatMessageOut])
async def get_order_messages(
    order_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    order = await _get_order_with_items(order_id, db)
    await _authorize_view(order, current_user, db)

    result = await db.execute(
        select(ChatMessage).where(ChatMessage.order_id == order_id).order_by(ChatMessage.sent_at)
    )
    return result.scalars().all()
