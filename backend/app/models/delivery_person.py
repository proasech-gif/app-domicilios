import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Numeric, func, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import ApprovalStatus, VehicleType


class DeliveryPerson(Base):
    __tablename__ = "delivery_persons"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    vehicle_type: Mapped[VehicleType] = mapped_column(Enum(VehicleType, name="vehicle_type"), nullable=False)
    vehicle_plate: Mapped[str | None] = mapped_column(String(20))
    id_document_url: Mapped[str | None] = mapped_column(String)
    license_document_url: Mapped[str | None] = mapped_column(String)
    vehicle_document_url: Mapped[str | None] = mapped_column(String)
    selfie_url: Mapped[str | None] = mapped_column(String)
    approval_status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus, name="approval_status"), default=ApprovalStatus.pending, nullable=False
    )
    is_available: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Porcentaje que la plataforma le cobra al domiciliario por cada domicilio
    # que entrega (se descuenta del valor del domicilio, igual que la comisión
    # que ya se le cobra al comercio sobre el valor de la comida).
    commission_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=10.00, nullable=False)
    current_location = mapped_column(Geography(geometry_type="POINT", srid=4326), nullable=True)
    last_location_update: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
