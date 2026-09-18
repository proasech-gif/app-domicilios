from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.core.database import get_db
from app.models.delivery_person import DeliveryPerson
from app.models.enums import ApprovalStatus, OrderStatus
from app.models.order import Order
from app.models.user import User, UserRole
from app.schemas.delivery import DeliveryProfileCreate, DeliveryLocationUpdate, DeliveryPersonOut
from app.services.geo import make_point
from app.websockets.manager import manager

router = APIRouter(prefix="/api/delivery", tags=["delivery"])

# Estados en los que el pedido sigue "en curso" y su tracking en vivo tiene sentido
_ACTIVE_TRACKING_STATUSES = {
    OrderStatus.domiciliario_asignado,
    OrderStatus.en_camino_a_comercio,
    OrderStatus.recogido,
    OrderStatus.en_camino_a_cliente,
}


@router.post("/profile", response_model=DeliveryPersonOut, status_code=status.HTTP_201_CREATED)
async def create_profile(
    data: DeliveryProfileCreate,
    current_user: Annotated[User, Depends(require_role(UserRole.domiciliario))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    existing = await db.execute(select(DeliveryPerson).where(DeliveryPerson.user_id == current_user.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya tienes un perfil de domiciliario")

    profile = DeliveryPerson(
        user_id=current_user.id,
        vehicle_type=data.vehicle_type,
        vehicle_plate=data.vehicle_plate,
        id_document_url=data.id_document_url,
        vehicle_document_url=data.vehicle_document_url,
        selfie_url=data.selfie_url,
        license_document_url=data.license_document_url,
        approval_status=ApprovalStatus.pending,  # requiere aprobación del admin
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/profile/me", response_model=DeliveryPersonOut)
async def get_my_profile(
    current_user: Annotated[User, Depends(require_role(UserRole.domiciliario))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(DeliveryPerson).where(DeliveryPerson.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil no encontrado")
    return profile


@router.patch("/availability", response_model=DeliveryPersonOut)
async def toggle_availability(
    current_user: Annotated[User, Depends(require_role(UserRole.domiciliario))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(DeliveryPerson).where(DeliveryPerson.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil no encontrado")
    if profile.approval_status != ApprovalStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tu perfil debe estar aprobado para activarte",
        )
    profile.is_available = not profile.is_available
    await db.commit()
    await db.refresh(profile)
    return profile


@router.patch("/location", response_model=DeliveryPersonOut)
async def update_location(
    data: DeliveryLocationUpdate,
    current_user: Annotated[User, Depends(require_role(UserRole.domiciliario))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(DeliveryPerson).where(DeliveryPerson.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil no encontrado")
    profile.current_location = make_point(data.latitude, data.longitude)
    await db.commit()
    await db.refresh(profile)

    # Transmitir la ubicación en vivo a todos los pedidos activos de este domiciliario
    active_orders = await db.execute(
        select(Order).where(
            Order.delivery_person_id == profile.id,
            Order.status.in_(_ACTIVE_TRACKING_STATUSES),
        )
    )
    for order in active_orders.scalars().all():
        await manager.publish_to_order(
            str(order.id),
            "driver.location_updated",
            {"latitude": data.latitude, "longitude": data.longitude},
        )

    return profile
