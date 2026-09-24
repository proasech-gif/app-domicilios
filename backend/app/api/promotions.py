import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.promotion import Promotion, PromotionRedemption
from app.models.restaurant import Restaurant
from app.models.user import User, UserRole
from app.schemas.promotion import (
    AdminPromotionCreate,
    PromotionCreate,
    PromotionOut,
    PromotionValidateResult,
    RedeemBonusResult,
)
from app.services.wallet_service import credit_wallet

router = APIRouter(prefix="/api/restaurants", tags=["promotions"])
promo_router = APIRouter(prefix="/api/promotions", tags=["promotions"])
admin_promo_router = APIRouter(prefix="/api/admin/promotions", tags=["promotions"])


async def _get_owned_restaurant(restaurant_id: uuid.UUID, user: User, db: AsyncSession) -> Restaurant:
    result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comercio no encontrado")
    if restaurant.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    return restaurant


# --- Cupones del comercio (para sus propios clientes) ---

@router.post("/{restaurant_id}/promotions", response_model=PromotionOut, status_code=status.HTTP_201_CREATED)
async def create_promotion(
    restaurant_id: uuid.UUID,
    data: PromotionCreate,
    current_user: Annotated[User, Depends(require_role(UserRole.comercio))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """El comercio crea un cupón para su propio negocio. Queda aprobado
    (activo) automáticamente, pero el administrador puede desaprobarlo
    después desde el panel."""
    await _get_owned_restaurant(restaurant_id, current_user, db)

    if data.discount_type == "percentage" and not (0 < data.discount_value <= 100):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="El descuento por porcentaje debe estar entre 1 y 100"
        )

    existing = await db.execute(select(Promotion).where(Promotion.code == data.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ese código de cupón ya existe")

    promotion = Promotion(
        restaurant_id=restaurant_id,
        code=data.code,
        description=data.description,
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        target_audience="cliente",
    )
    db.add(promotion)
    await db.commit()
    await db.refresh(promotion)
    return promotion


@router.get("/{restaurant_id}/promotions", response_model=list[PromotionOut])
async def list_promotions(
    restaurant_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.comercio))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_owned_restaurant(restaurant_id, current_user, db)
    result = await db.execute(select(Promotion).where(Promotion.restaurant_id == restaurant_id))
    return result.scalars().all()


@promo_router.patch("/{promotion_id}/toggle", response_model=PromotionOut)
async def toggle_own_promotion(
    promotion_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.comercio))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """El comercio activa/desactiva su propio cupón (por ejemplo, para
    pausarlo antes de la fecha de fin)."""
    result = await db.execute(select(Promotion).where(Promotion.id == promotion_id))
    promotion = result.scalar_one_or_none()
    if not promotion or promotion.restaurant_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cupón no encontrado")
    await _get_owned_restaurant(promotion.restaurant_id, current_user, db)
    promotion.is_active = not promotion.is_active
    await db.commit()
    await db.refresh(promotion)
    return promotion


# --- Validar un cupón de CLIENTE (comercio o plataforma) ---

@promo_router.get("/validate", response_model=PromotionValidateResult)
async def validate_promotion(
    code: str,
    restaurant_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Revisa si un código es válido para ese comercio: puede ser un cupón
    propio del comercio, o un cupón de plataforma dirigido a su tipo de
    negocio (o a todos)."""
    restaurant_result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = restaurant_result.scalar_one_or_none()
    if not restaurant:
        return PromotionValidateResult(valid=False, reason="Comercio no encontrado")

    result = await db.execute(select(Promotion).where(Promotion.code == code.strip().upper()))
    promotion = result.scalar_one_or_none()
    if not promotion or promotion.target_audience != "cliente":
        return PromotionValidateResult(valid=False, reason="Cupón no encontrado")

    belongs_to_restaurant = promotion.restaurant_id == restaurant_id
    is_platform_wide = promotion.restaurant_id is None and (
        promotion.target_business_type is None or promotion.target_business_type == restaurant.business_type.value
    )
    if not (belongs_to_restaurant or is_platform_wide):
        return PromotionValidateResult(valid=False, reason="Ese cupón no aplica para este comercio")

    if not promotion.is_active:
        return PromotionValidateResult(valid=False, reason="Cupón inactivo")
    now = datetime.now(timezone.utc)
    if promotion.starts_at and now < promotion.starts_at:
        return PromotionValidateResult(valid=False, reason="Este cupón todavía no ha empezado")
    if promotion.ends_at and now > promotion.ends_at:
        return PromotionValidateResult(valid=False, reason="Este cupón ya venció")

    return PromotionValidateResult(
        valid=True,
        code=promotion.code,
        discount_type=promotion.discount_type,
        discount_value=float(promotion.discount_value),
    )


# --- Bonos para comercios y domiciliarios ---

@promo_router.post("/redeem-bonus", response_model=RedeemBonusResult)
async def redeem_bonus(
    code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """El comercio o el domiciliario canjea un código de bono de la
    plataforma. Cada usuario solo puede canjear un mismo código una vez."""
    if current_user.role not in (UserRole.comercio, UserRole.domiciliario):
        return RedeemBonusResult(valid=False, reason="Los bonos solo son para comercios y domiciliarios")

    result = await db.execute(select(Promotion).where(Promotion.code == code.strip().upper()))
    promotion = result.scalar_one_or_none()
    if not promotion or promotion.target_audience != current_user.role.value:
        return RedeemBonusResult(valid=False, reason="Código no encontrado")
    if not promotion.is_active:
        return RedeemBonusResult(valid=False, reason="Este bono ya no está activo")
    now = datetime.now(timezone.utc)
    if promotion.starts_at and now < promotion.starts_at:
        return RedeemBonusResult(valid=False, reason="Este bono todavía no ha empezado")
    if promotion.ends_at and now > promotion.ends_at:
        return RedeemBonusResult(valid=False, reason="Este bono ya venció")

    already_used = await db.execute(
        select(PromotionRedemption).where(
            PromotionRedemption.promotion_id == promotion.id,
            PromotionRedemption.user_id == current_user.id,
        )
    )
    if already_used.scalar_one_or_none():
        return RedeemBonusResult(valid=False, reason="Ya canjeaste este bono antes")

    amount_cents = round(float(promotion.discount_value) * 100)
    await credit_wallet(db, current_user.id, amount_cents, None, f"Bono: {promotion.description or promotion.code}")
    db.add(PromotionRedemption(promotion_id=promotion.id, user_id=current_user.id))
    await db.commit()
    return RedeemBonusResult(valid=True, amount_credited_cents=amount_cents)


# --- Administración de cupones de plataforma ---

@admin_promo_router.post("", response_model=PromotionOut, status_code=status.HTTP_201_CREATED)
async def admin_create_promotion(
    data: AdminPromotionCreate,
    _: Annotated[User, Depends(require_role(UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if data.discount_type == "percentage" and not (0 < data.discount_value <= 100):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="El descuento por porcentaje debe estar entre 1 y 100"
        )
    existing = await db.execute(select(Promotion).where(Promotion.code == data.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ese código de cupón ya existe")

    promotion = Promotion(
        restaurant_id=None,
        code=data.code,
        description=data.description,
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        target_audience=data.target_audience,
        target_business_type=data.target_business_type,
    )
    db.add(promotion)
    await db.commit()
    await db.refresh(promotion)
    return promotion


@admin_promo_router.get("", response_model=list[PromotionOut])
async def admin_list_promotions(
    _: Annotated[User, Depends(require_role(UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Todos los cupones que existen: los del comercio y los de plataforma."""
    result = await db.execute(select(Promotion).order_by(Promotion.starts_at.desc().nullslast()))
    return result.scalars().all()


@admin_promo_router.patch("/{promotion_id}/approve", response_model=PromotionOut)
async def admin_approve_promotion(
    promotion_id: uuid.UUID,
    _: Annotated[User, Depends(require_role(UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Promotion).where(Promotion.id == promotion_id))
    promotion = result.scalar_one_or_none()
    if not promotion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cupón no encontrado")
    promotion.is_active = True
    await db.commit()
    await db.refresh(promotion)
    return promotion


@admin_promo_router.patch("/{promotion_id}/disapprove", response_model=PromotionOut)
async def admin_disapprove_promotion(
    promotion_id: uuid.UUID,
    _: Annotated[User, Depends(require_role(UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Promotion).where(Promotion.id == promotion_id))
    promotion = result.scalar_one_or_none()
    if not promotion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cupón no encontrado")
    promotion.is_active = False
    await db.commit()
    await db.refresh(promotion)
    return promotion
