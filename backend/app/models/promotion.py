import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Promotion(Base):
    """Cupón de descuento: puede ser de un comercio específico (para sus
    clientes), o de la plataforma (dirigido a un tipo de negocio completo, o
    como bono para domiciliarios)."""

    __tablename__ = "promotions"
    __table_args__ = (
        CheckConstraint("discount_type IN ('percentage', 'fixed')", name="promotions_discount_type_check"),
        CheckConstraint("target_audience IN ('cliente', 'comercio', 'domiciliario')", name="promotions_target_audience_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("restaurants.id"))
    code: Mapped[str | None] = mapped_column(String(50), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    discount_type: Mapped[str] = mapped_column(String(20))
    discount_value: Mapped[float] = mapped_column(Numeric(10, 2))
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Solo aplica a cupones de plataforma (restaurant_id nulo): a qué tipo de
    # negocio va dirigido. Null = aplica a todos los tipos.
    target_business_type: Mapped[str | None] = mapped_column(String(20))
    # A quién beneficia este cupón: "cliente" (descuento normal) o
    # "domiciliario" (bono que se acredita a su billetera).
    target_audience: Mapped[str] = mapped_column(String(20), default="cliente")


class PromotionRedemption(Base):
    """Registra quién ya usó un cupón, para que nadie pueda reclamarlo dos
    veces (un domiciliario no puede cobrar el mismo bono repetidas veces)."""

    __tablename__ = "promotion_redemptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    promotion_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("promotions.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"))
    redeemed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
