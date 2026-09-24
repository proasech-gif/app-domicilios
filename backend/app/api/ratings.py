import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.enums import OrderStatus
from app.models.order import Order
from app.models.rating import Rating
from app.models.user import User, UserRole
from app.schemas.rating import RatingCreate, RatingOut, RatingSummary

router = APIRouter(prefix="/api/orders", tags=["ratings"])
public_router = APIRouter(prefix="/api", tags=["ratings"])


@router.post("/{order_id}/ratings", response_model=RatingOut, status_code=status.HTTP_201_CREATED)
async def create_rating(
    order_id: uuid.UUID,
    data: RatingCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """El cliente dueño del pedido califica al restaurante o al domiciliario,
    solo si el pedido ya fue entregado y solo una vez por pedido+destino."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
    if order.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    if order.status != OrderStatus.entregado:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se puede calificar un pedido ya entregado"
        )

    if data.target_type == "restaurant":
        if data.target_id != order.restaurant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Ese restaurante no corresponde a este pedido"
            )
    else:
        if order.delivery_person_id is None or data.target_id != order.delivery_person_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Ese domiciliario no corresponde a este pedido"
            )

    existing = await db.execute(
        select(Rating).where(
            Rating.order_id == order_id,
            Rating.rater_id == current_user.id,
            Rating.target_type == data.target_type,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ya calificaste esto en este pedido")

    rating = Rating(
        order_id=order_id,
        rater_id=current_user.id,
        target_type=data.target_type,
        target_id=data.target_id,
        score=data.score,
        comment=data.comment,
    )
    db.add(rating)
    await db.commit()
    await db.refresh(rating)
    return rating


@router.get("/{order_id}/ratings", response_model=list[RatingOut])
async def list_order_ratings(
    order_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
    if order.customer_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    ratings_result = await db.execute(select(Rating).where(Rating.order_id == order_id))
    return ratings_result.scalars().all()


@public_router.get("/restaurants/{restaurant_id}/rating-summary", response_model=RatingSummary)
async def restaurant_rating_summary(restaurant_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    """Promedio de calificación y cantidad de calificaciones de un restaurante.
    Público (sin login), para poder mostrarlo en el listado de la app cliente."""
    result = await db.execute(
        select(func.avg(Rating.score), func.count(Rating.id)).where(
            Rating.target_type == "restaurant", Rating.target_id == restaurant_id
        )
    )
    avg_score, total = result.one()
    return RatingSummary(average_score=round(float(avg_score), 2) if avg_score else 0.0, total_ratings=total or 0)


@public_router.get("/delivery/{delivery_person_id}/rating-summary", response_model=RatingSummary)
async def delivery_person_rating_summary(
    delivery_person_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]
):
    result = await db.execute(
        select(func.avg(Rating.score), func.count(Rating.id)).where(
            Rating.target_type == "delivery_person", Rating.target_id == delivery_person_id
        )
    )
    avg_score, total = result.one()
    return RatingSummary(average_score=round(float(avg_score), 2) if avg_score else 0.0, total_ratings=total or 0)
