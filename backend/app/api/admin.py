import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.orm import selectinload

from app.api.deps import require_role
from app.core.database import get_db
from app.models.delivery_person import DeliveryPerson
from app.models.enums import ApprovalStatus, OrderStatus, WithdrawalStatus
from app.models.order import Order
from app.models.restaurant import Restaurant
from app.models.user import User, UserRole
from app.models.wallet import Wallet, WithdrawalRequest
from app.schemas.delivery import DeliveryPersonOut
from app.schemas.order import OrderOut
from app.schemas.restaurant import RestaurantOut
from app.schemas.auth import UserOut
from app.services.wallet_service import debit_wallet
from datetime import datetime, timezone
from pydantic import BaseModel

router = APIRouter(prefix="/api/admin", tags=["admin"])

_admin_only = require_role(UserRole.admin)


# --- Comercios ---

@router.get("/restaurants/pending", response_model=list[RestaurantOut])
async def pending_restaurants(
    _: Annotated[User, Depends(_admin_only)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Restaurant).where(Restaurant.approval_status == ApprovalStatus.pending))
    return result.scalars().all()


@router.patch("/restaurants/{restaurant_id}/approve", response_model=RestaurantOut)
async def approve_restaurant(
    restaurant_id: uuid.UUID,
    _: Annotated[User, Depends(_admin_only)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    restaurant = await _get_restaurant_or_404(restaurant_id, db)
    restaurant.approval_status = ApprovalStatus.approved
    await db.commit()
    await db.refresh(restaurant)
    # NOTA: aquí se debe disparar una notificación push/email al comercio.
    return restaurant


@router.patch("/restaurants/{restaurant_id}/reject", response_model=RestaurantOut)
async def reject_restaurant(
    restaurant_id: uuid.UUID,
    _: Annotated[User, Depends(_admin_only)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    restaurant = await _get_restaurant_or_404(restaurant_id, db)
    restaurant.approval_status = ApprovalStatus.rejected
    await db.commit()
    await db.refresh(restaurant)
    return restaurant


@router.patch("/restaurants/{restaurant_id}/suspend", response_model=RestaurantOut)
async def suspend_restaurant(
    restaurant_id: uuid.UUID,
    _: Annotated[User, Depends(_admin_only)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    restaurant = await _get_restaurant_or_404(restaurant_id, db)
    restaurant.approval_status = ApprovalStatus.suspended
    restaurant.is_open = False
    await db.commit()
    await db.refresh(restaurant)
    return restaurant


# --- Domiciliarios ---

@router.get("/delivery-persons/pending", response_model=list[DeliveryPersonOut])
async def pending_delivery_persons(
    _: Annotated[User, Depends(_admin_only)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(DeliveryPerson).where(DeliveryPerson.approval_status == ApprovalStatus.pending)
    )
    return result.scalars().all()


@router.patch("/delivery-persons/{delivery_person_id}/approve", response_model=DeliveryPersonOut)
async def approve_delivery_person(
    delivery_person_id: uuid.UUID,
    _: Annotated[User, Depends(_admin_only)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    profile = await _get_delivery_person_or_404(delivery_person_id, db)
    profile.approval_status = ApprovalStatus.approved
    await db.commit()
    await db.refresh(profile)
    return profile


@router.patch("/delivery-persons/{delivery_person_id}/reject", response_model=DeliveryPersonOut)
async def reject_delivery_person(
    delivery_person_id: uuid.UUID,
    _: Annotated[User, Depends(_admin_only)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    profile = await _get_delivery_person_or_404(delivery_person_id, db)
    profile.approval_status = ApprovalStatus.rejected
    await db.commit()
    await db.refresh(profile)
    return profile


# --- Usuarios (listado y suspensión general) ---

@router.get("/users", response_model=list[UserOut])
async def list_users(
    _: Annotated[User, Depends(_admin_only)],
    db: Annotated[AsyncSession, Depends(get_db)],
    role_filter: UserRole | None = None,
):
    query = select(User).order_by(User.created_at.desc())
    if role_filter:
        query = query.where(User.role == role_filter)
    result = await db.execute(query)
    return result.scalars().all()


@router.patch("/users/{user_id}/suspend")
async def suspend_user(
    user_id: uuid.UUID,
    _: Annotated[User, Depends(_admin_only)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    user.is_active = False
    await db.commit()
    return {"detail": "Usuario suspendido"}


@router.patch("/users/{user_id}/reactivate")
async def reactivate_user(
    user_id: uuid.UUID,
    _: Annotated[User, Depends(_admin_only)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    user.is_active = True
    await db.commit()
    return {"detail": "Usuario reactivado"}


# --- Pedidos (vista global) ---

@router.get("/orders", response_model=list[OrderOut])
async def all_orders(
    _: Annotated[User, Depends(_admin_only)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: OrderStatus | None = None,
):
    query = select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc())
    if status_filter:
        query = query.where(Order.status == status_filter)
    result = await db.execute(query)
    return result.scalars().all()


# --- Estadísticas básicas ---

@router.get("/stats")
async def dashboard_stats(
    _: Annotated[User, Depends(_admin_only)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    total_orders = await db.execute(select(Order))
    orders = total_orders.scalars().all()
    active_statuses = {
        OrderStatus.creado, OrderStatus.confirmado_comercio, OrderStatus.en_preparacion,
        OrderStatus.listo_para_recoger, OrderStatus.domiciliario_asignado,
        OrderStatus.en_camino_a_comercio, OrderStatus.recogido, OrderStatus.en_camino_a_cliente,
    }
    return {
        "total_orders": len(orders),
        "active_orders": sum(1 for o in orders if o.status in active_statuses),
        "delivered_orders": sum(1 for o in orders if o.status == OrderStatus.entregado),
        "cancelled_orders": sum(1 for o in orders if o.status == OrderStatus.cancelado),
        "total_revenue": sum(float(o.total) for o in orders if o.status == OrderStatus.entregado),
    }


# --- Helpers internos ---

async def _get_restaurant_or_404(restaurant_id: uuid.UUID, db: AsyncSession) -> Restaurant:
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comercio no encontrado")
    return restaurant


async def _get_delivery_person_or_404(delivery_person_id: uuid.UUID, db: AsyncSession) -> DeliveryPerson:
    result = await db.execute(select(DeliveryPerson).where(DeliveryPerson.id == delivery_person_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domiciliario no encontrado")
    return profile


# --- Retiros de billetera ---

class WithdrawalAdminOut(BaseModel):
    id: uuid.UUID
    wallet_id: uuid.UUID
    user_email: str
    user_full_name: str
    amount_cents: int
    bank_info: str
    status: WithdrawalStatus
    requested_at: datetime

    class Config:
        from_attributes = True


@router.get("/withdrawals/pending", response_model=list[WithdrawalAdminOut])
async def pending_withdrawals(
    current_user: Annotated[User, Depends(require_role(UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(WithdrawalRequest, Wallet, User)
        .join(Wallet, Wallet.id == WithdrawalRequest.wallet_id)
        .join(User, User.id == Wallet.user_id)
        .where(WithdrawalRequest.status == WithdrawalStatus.pendiente)
        .order_by(WithdrawalRequest.requested_at.asc())
    )
    rows = result.all()
    return [
        WithdrawalAdminOut(
            id=w.id,
            wallet_id=w.wallet_id,
            user_email=u.email,
            user_full_name=u.full_name,
            amount_cents=w.amount_cents,
            bank_info=w.bank_info,
            status=w.status,
            requested_at=w.requested_at,
        )
        for w, wallet, u in rows
    ]


@router.patch("/withdrawals/{withdrawal_id}/complete", response_model=WithdrawalAdminOut)
async def complete_withdrawal(
    withdrawal_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """El admin marca el retiro como completado DESPUÉS de hacer la transferencia bancaria real
    manualmente (fuera del sistema). Esto descuenta el saldo de la billetera."""
    result = await db.execute(select(WithdrawalRequest).where(WithdrawalRequest.id == withdrawal_id))
    withdrawal = result.scalar_one_or_none()
    if not withdrawal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada")
    if withdrawal.status != WithdrawalStatus.pendiente:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta solicitud ya fue procesada")

    wallet_result = await db.execute(select(Wallet).where(Wallet.id == withdrawal.wallet_id))
    wallet = wallet_result.scalar_one_or_none()
    if not wallet or wallet.balance_cents < withdrawal.amount_cents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Saldo insuficiente en la billetera")

    await debit_wallet(db, wallet, withdrawal.amount_cents, "Retiro a cuenta bancaria")
    withdrawal.status = WithdrawalStatus.completado
    withdrawal.processed_at = datetime.now(timezone.utc)
    withdrawal.processed_by = current_user.id
    await db.commit()
    await db.refresh(withdrawal)

    user_result = await db.execute(select(User).where(User.id == wallet.user_id))
    u = user_result.scalar_one()
    return WithdrawalAdminOut(
        id=withdrawal.id,
        wallet_id=withdrawal.wallet_id,
        user_email=u.email,
        user_full_name=u.full_name,
        amount_cents=withdrawal.amount_cents,
        bank_info=withdrawal.bank_info,
        status=withdrawal.status,
        requested_at=withdrawal.requested_at,
    )


@router.patch("/withdrawals/{withdrawal_id}/reject", response_model=WithdrawalAdminOut)
async def reject_withdrawal(
    withdrawal_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(WithdrawalRequest).where(WithdrawalRequest.id == withdrawal_id))
    withdrawal = result.scalar_one_or_none()
    if not withdrawal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada")
    if withdrawal.status != WithdrawalStatus.pendiente:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta solicitud ya fue procesada")

    withdrawal.status = WithdrawalStatus.rechazado
    withdrawal.processed_at = datetime.now(timezone.utc)
    withdrawal.processed_by = current_user.id
    await db.commit()
    await db.refresh(withdrawal)

    wallet_result = await db.execute(select(Wallet).where(Wallet.id == withdrawal.wallet_id))
    wallet = wallet_result.scalar_one()
    user_result = await db.execute(select(User).where(User.id == wallet.user_id))
    u = user_result.scalar_one()
    return WithdrawalAdminOut(
        id=withdrawal.id,
        wallet_id=withdrawal.wallet_id,
        user_email=u.email,
        user_full_name=u.full_name,
        amount_cents=withdrawal.amount_cents,
        bank_info=withdrawal.bank_info,
        status=withdrawal.status,
        requested_at=withdrawal.requested_at,
    )
