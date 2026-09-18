import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.delivery_person import DeliveryPerson
from app.models.enums import ApprovalStatus, OrderStatus, PaymentStatus
from app.models.order import Order, OrderItem, OrderStatusHistory
from app.models.restaurant import Restaurant, Product
from app.models.user import User, UserRole
from app.models.wallet import Payment
from app.schemas.order import OrderCreate, OrderOut, OrderStatusUpdate
from app.services.order_service import validate_transition
from app.services.wallet_service import credit_wallet
from app.websockets.manager import manager

router = APIRouter(prefix="/api/orders", tags=["orders"])


async def _get_order_with_items(order_id: uuid.UUID, db: AsyncSession) -> Order:
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
    return order


async def _authorize_view(order: Order, user: User, db: AsyncSession) -> None:
    """El cliente dueño, el comercio dueño, el domiciliario asignado o un admin pueden ver el pedido.

    IMPORTANTE: antes esta función dejaba pasar a CUALQUIER comercio o domiciliario
    autenticado, sin verificar que el pedido realmente fuera suyo (IDOR). Ahora se
    valida la pertenencia real contra la base de datos.
    """
    if user.role == UserRole.admin:
        return
    if user.role == UserRole.cliente and order.customer_id == user.id:
        return
    if user.role == UserRole.comercio:
        restaurant_result = await db.execute(select(Restaurant).where(Restaurant.id == order.restaurant_id))
        restaurant = restaurant_result.scalar_one_or_none()
        if restaurant and restaurant.owner_id == user.id:
            return
    if user.role == UserRole.domiciliario:
        profile_result = await db.execute(select(DeliveryPerson).where(DeliveryPerson.user_id == user.id))
        profile = profile_result.scalar_one_or_none()
        if profile and order.delivery_person_id == profile.id:
            return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    current_user: Annotated[User, Depends(require_role(UserRole.cliente))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Validar comercio
    restaurant_result = await db.execute(select(Restaurant).where(Restaurant.id == data.restaurant_id))
    restaurant = restaurant_result.scalar_one_or_none()
    if not restaurant or restaurant.approval_status != ApprovalStatus.approved:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comercio no disponible")
    if not restaurant.is_open:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El comercio está cerrado")

    # Validar productos y calcular subtotal
    product_ids = [item.product_id for item in data.items]
    products_result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
    products = {p.id: p for p in products_result.scalars().all()}

    subtotal = 0.0
    order_items: list[OrderItem] = []
    for item in data.items:
        product = products.get(item.product_id)
        if not product or product.restaurant_id != restaurant.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Producto {item.product_id} no pertenece a este comercio",
            )
        if not product.is_available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{product.name}' no está disponible actualmente",
            )
        line_total = float(product.price) * item.quantity
        subtotal += line_total
        order_items.append(
            OrderItem(product_id=product.id, quantity=item.quantity, unit_price=product.price, notes=item.notes)
        )

    delivery_fee = 5000.0  # TODO: calcular por distancia real en fase de geolocalización avanzada
    commission_amount = round(subtotal * float(restaurant.commission_rate) / 100, 2)
    total = subtotal + delivery_fee

    order = Order(
        customer_id=current_user.id,
        restaurant_id=restaurant.id,
        delivery_address_id=data.delivery_address_id,
        payment_method=data.payment_method,
        payment_status=PaymentStatus.contra_entrega if data.payment_method == "efectivo" else PaymentStatus.pendiente,
        subtotal=subtotal,
        delivery_fee=delivery_fee,
        commission_amount=commission_amount,
        total=total,
        notes=data.notes,
        status=OrderStatus.creado,
        items=order_items,
    )
    db.add(order)
    await db.flush()
    db.add(OrderStatusHistory(order_id=order.id, status=OrderStatus.creado, changed_by=current_user.id))
    await db.commit()
    await db.refresh(order, attribute_names=["items"])

    await manager.publish_to_user(
        str(restaurant.owner_id),
        "order.created",
        {"order_id": str(order.id), "status": order.status.value},
    )
    return order


@router.get("/mine", response_model=list[OrderOut])
async def my_orders(
    current_user: Annotated[User, Depends(require_role(UserRole.cliente))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.customer_id == current_user.id)
    )
    return result.scalars().all()


@router.get("/restaurant/{restaurant_id}", response_model=list[OrderOut])
async def restaurant_orders(
    restaurant_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.comercio))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    restaurant_result = await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
    restaurant = restaurant_result.scalar_one_or_none()
    if not restaurant or restaurant.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No eres dueño de este comercio")

    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.restaurant_id == restaurant_id)
    )
    return result.scalars().all()


@router.get("/available-for-pickup", response_model=list[OrderOut])
async def available_for_pickup(
    current_user: Annotated[User, Depends(require_role(UserRole.domiciliario))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Pedidos listos para recoger, sin domiciliario asignado (para que el repartidor los tome)."""
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.status == OrderStatus.listo_para_recoger, Order.delivery_person_id.is_(None))
    )
    return result.scalars().all()


@router.get("/my-deliveries", response_model=list[OrderOut])
async def my_deliveries(
    current_user: Annotated[User, Depends(require_role(UserRole.domiciliario))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Pedidos que este domiciliario ya tomó (activos e histórico reciente)."""
    profile_result = await db.execute(select(DeliveryPerson).where(DeliveryPerson.user_id == current_user.id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return []
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.delivery_person_id == profile.id)
        .order_by(Order.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    order = await _get_order_with_items(order_id, db)
    await _authorize_view(order, current_user, db)
    return order


@router.post("/{order_id}/assign-delivery", response_model=OrderOut)
async def assign_delivery(
    order_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.domiciliario))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Un domiciliario disponible y aprobado toma un pedido listo para recoger."""
    profile_result = await db.execute(select(DeliveryPerson).where(DeliveryPerson.user_id == current_user.id))
    profile = profile_result.scalar_one_or_none()
    if not profile or profile.approval_status != ApprovalStatus.approved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Perfil de domiciliario no aprobado")
    if not profile.is_available:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes estar disponible para tomar pedidos")

    order = await _get_order_with_items(order_id, db)
    if order.status != OrderStatus.listo_para_recoger or order.delivery_person_id is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este pedido ya no está disponible")

    order.delivery_person_id = profile.id
    order.status = OrderStatus.domiciliario_asignado
    db.add(OrderStatusHistory(order_id=order.id, status=OrderStatus.domiciliario_asignado, changed_by=current_user.id))
    await db.commit()
    await db.refresh(order, attribute_names=["items"])

    restaurant_result = await db.execute(select(Restaurant).where(Restaurant.id == order.restaurant_id))
    restaurant = restaurant_result.scalar_one_or_none()

    event_payload = {"order_id": str(order.id), "status": order.status.value, "delivery_person_id": str(profile.id)}
    await manager.publish_to_order(str(order.id), "order.status_changed", event_payload)
    await manager.publish_to_user(str(order.customer_id), "order.status_changed", event_payload)
    if restaurant:
        await manager.publish_to_user(str(restaurant.owner_id), "order.status_changed", event_payload)

    return order


@router.patch("/{order_id}/status", response_model=OrderOut)
async def update_order_status(
    order_id: uuid.UUID,
    data: OrderStatusUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    order = await _get_order_with_items(order_id, db)

    # Verificación adicional de pertenencia según rol
    if current_user.role == UserRole.comercio:
        restaurant_result = await db.execute(select(Restaurant).where(Restaurant.id == order.restaurant_id))
        restaurant = restaurant_result.scalar_one_or_none()
        if not restaurant or restaurant.owner_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    elif current_user.role == UserRole.domiciliario:
        profile_result = await db.execute(select(DeliveryPerson).where(DeliveryPerson.user_id == current_user.id))
        profile = profile_result.scalar_one_or_none()
        if not profile or order.delivery_person_id != profile.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    elif current_user.role == UserRole.cliente and order.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    validate_transition(order.status, data.status, current_user.role)

    # Si el pedido se paga online (tarjeta/billetera digital), el comercio no puede
    # empezar a prepararlo hasta que el pago esté realmente aprobado por Wompi.
    if (
        data.status == OrderStatus.confirmado_comercio
        and order.payment_method != "efectivo"
        and order.payment_status != PaymentStatus.aprobado
    ):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="El pago de este pedido aún no ha sido confirmado por la pasarela de pagos",
        )

    order.status = data.status
    db.add(OrderStatusHistory(order_id=order.id, status=data.status, changed_by=current_user.id))

    # Al entregar, se reparte automáticamente el dinero a las billeteras internas
    # del comercio y del domiciliario (menos la comisión de la plataforma).
    if data.status == OrderStatus.entregado:
        restaurant_for_payout = await db.execute(select(Restaurant).where(Restaurant.id == order.restaurant_id))
        restaurant_obj = restaurant_for_payout.scalar_one_or_none()
        if restaurant_obj:
            comercio_share_cents = round((float(order.subtotal) - float(order.commission_amount)) * 100)
            await credit_wallet(
                db,
                restaurant_obj.owner_id,
                comercio_share_cents,
                order.id,
                f"Venta pedido #{str(order.id)[:8]}",
            )
        if order.delivery_person_id:
            dp_for_payout = await db.execute(
                select(DeliveryPerson).where(DeliveryPerson.id == order.delivery_person_id)
            )
            dp_obj = dp_for_payout.scalar_one_or_none()
            if dp_obj:
                domicilio_share_cents = round(float(order.delivery_fee) * 100)
                await credit_wallet(
                    db,
                    dp_obj.user_id,
                    domicilio_share_cents,
                    order.id,
                    f"Domicilio pedido #{str(order.id)[:8]}",
                )

    await db.commit()
    await db.refresh(order, attribute_names=["items"])

    # Notificar a las 3 partes involucradas (cliente, comercio, domiciliario si aplica)
    event_payload = {"order_id": str(order.id), "status": order.status.value}
    await manager.publish_to_order(str(order.id), "order.status_changed", event_payload)
    await manager.publish_to_user(str(order.customer_id), "order.status_changed", event_payload)

    restaurant_result = await db.execute(select(Restaurant).where(Restaurant.id == order.restaurant_id))
    restaurant = restaurant_result.scalar_one_or_none()
    if restaurant:
        await manager.publish_to_user(str(restaurant.owner_id), "order.status_changed", event_payload)

    if order.delivery_person_id:
        dp_result = await db.execute(select(DeliveryPerson).where(DeliveryPerson.id == order.delivery_person_id))
        delivery_profile = dp_result.scalar_one_or_none()
        if delivery_profile:
            await manager.publish_to_user(str(delivery_profile.user_id), "order.status_changed", event_payload)

    return order
