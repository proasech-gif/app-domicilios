import uuid
from datetime import datetime

from pydantic import BaseModel


class ChatMessageOut(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    sender_id: uuid.UUID
    message: str
    sent_at: datetime

    class Config:
        from_attributes = True


class NotificationOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    body: str
    data: dict | None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
