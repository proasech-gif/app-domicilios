import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class RatingCreate(BaseModel):
    target_type: Literal["restaurant", "delivery_person"]
    target_id: uuid.UUID
    score: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=500)


class RatingOut(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    rater_id: uuid.UUID
    target_type: str
    target_id: uuid.UUID
    score: int
    comment: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class RatingSummary(BaseModel):
    average_score: float
    total_ratings: int
