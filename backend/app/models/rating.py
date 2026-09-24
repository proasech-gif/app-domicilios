import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Rating(Base):
    """Calificación de 1 a 5 estrellas que un cliente deja sobre un restaurante o
    un domiciliario, asociada a un pedido específico ya entregado.

    target_type/target_id no son una llave foránea real en la base de datos
    (apuntan a restaurants o a delivery_persons según el caso), así que la
    validación de que apunten a algo real se hace a nivel de código, no de
    base de datos — igual que ya estaba definido en la tabla original.
    """

    __tablename__ = "ratings"
    __table_args__ = (
        CheckConstraint("target_type IN ('restaurant', 'delivery_person')", name="ratings_target_type_check"),
        CheckConstraint("score >= 1 AND score <= 5", name="ratings_score_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"))
    rater_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    target_type: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    score: Mapped[int] = mapped_column(SmallInteger)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
