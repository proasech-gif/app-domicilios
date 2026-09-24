import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ReportReason = Literal[
    "producto_incorrecto",
    "producto_danado",
    "domiciliario_no_llego",
    "comportamiento_inapropiado",
    "cobro_incorrecto",
    "otro",
]

ReportStatus = Literal["abierto", "en_revision", "resuelto", "descartado"]


class ReportCreate(BaseModel):
    order_id: uuid.UUID | None = None
    reason: ReportReason
    description: str | None = Field(default=None, max_length=1000)


class ReportOut(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID | None
    reported_by: uuid.UUID
    reason: str
    description: str | None
    status: str
    created_at: datetime
    resolved_at: datetime | None

    class Config:
        from_attributes = True


class ReportStatusUpdate(BaseModel):
    status: ReportStatus
