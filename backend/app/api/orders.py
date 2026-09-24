import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.address import Address
from app.models.delivery_person import DeliveryPerson
from app.models.enums import ApprovalStatus, OrderStatus, PaymentStatus
from app.models.order import Order, OrderItem, OrderStatusHistory
from app.models.promotion import Promotion, PromotionRedemption
from app.models.restaurant import Restaurant, Product
from app.models.user import User, UserRole
from app.models.wallet import Payment
from app.schemas.order import OrderCreate, OrderOut, OrderStatusUpdate
from app.services.order_service import validate_transition
from app.services.delivery_fee import calculate_delivery_fee
from app.services.push_service import notify_user
from app.services.wallet_service import credit_wallet, debit_wallet, get_or_create_wallet
from app.websockets.manager import manager

router = APIRouter(prefix="/api/orders", tags=["orders"])

# Mensaje amigable que se le muestra al CLIENTE en la notificación push según el
# nuevo estado del pedido. Los estados que no están aquí (p. ej. domiciliario_asignado,
# que ya se notifica aparte en assign_delivery) simplemente no generan push extra.
ORDER_STATUS_CUSTOMER_MESSAGES: dict[OrderStatus, str] = {
    OrderStatus.confirmado_comercio: "El comercio confirmó tu pedido y ya lo está preparando.",
    OrderStatus.listo_para_recoger: "Tu pedido está listo, esperando a que un domiciliario lo recoja.",
    OrderStatus.recogido: "Tu pedido fue recogido y va en camino a tu dirección.",
    OrderStatus.en_camino_a_cliente: "¡Tu domiciliario va en camino a tu dirección!",
    OrderStatus.entregado: "Tu pedido fue entregado. ¡Buen provecho! 🎉",
    OrderStatus.cancelado: "Tu pedido fue cancelado.",
}


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


@router.get("/delivery-fee-preview")
async def delivery_fee_preview(
    restaurant_id: uuid.UUID,
    address_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Le permite a la app cliente mostrar el valor REAL del domicilio antes
    de confirmar el pedido (según distancia real y hora del día), en vez de
    un estimado fijo que no coincidiría con lo que se cobra de verdad."""
    distance_result = await db.execute(
        select(func.ST_Distance(Restaurant.location, Address.location))
        .where(Restaurant.id == restaurant_id)
        .where(Address.id == address_id)
    )
    distance_meters = distance_result.scalar_one_or_none()
    if distance_meters is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comercio o dirección no encontrados")
    delivery_fee = calculate_delivery_fee(distance_meters / 1000)
    return {"delivery_fee": delivery_fee, "distance_km": round(distance_meters / 1000, 2)}


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

    # Distancia real entre el comercio y la dirección de entrega, para
    # calcular el valor del domicilio (mínimo + tarifa por km, distinta de
    # día y de noche). De paso, esto confirma que la dirección exista Y le
    # pertenezca al cliente que hace el pedido (antes no se validaba nada de
    # esto — cualquiera podía usar la dirección de otra persona).
    address_result = await db.execute(
        select(Address).where(Address.id == data.delivery_address_id, Address.user_id == current_user.id)
    )
    delivery_address = address_result.scalar_one_or_none()
    if not delivery_address:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dirección de entrega no válida")

    distance_result = await db.execute(
        select(func.ST_Distance(Restaurant.location, Address.location)).where(
            Restaurant.id == restaurant.id, Address.id == delivery_address.id
        )
    )
    distance_meters = distance_result.scalar_one()
    delivery_fee = calculate_delivery_fee(distance_meters / 1000)

    commission_amount = round(subtotal * float(restaurant.commission_rate) / 100, 2)

    # Cupón (opcional): puede ser del propio comercio, o de plataforma dirigido
    # a este tipo de negocio (o a todos).
    promotion = None
    discount_amount = 0.0
    if data.promo_code:
        promo_result = await db.execute(select(Promotion).where(Promotion.code == data.promo_code.strip().upper()))
        promotion = promo_result.scalar_one_or_none()
        if not promotion or promotion.target_audience != "cliente":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cupón no encontrado")

        belongs_to_restaurant = promotion.restaurant_id == restaurant.id
        is_platform_wide = promotion.restaurant_id is None and (
            promotion.target_business_type is None or promotion.target_business_type == restaurant.business_type.value
        )
        if not (belongs_to_restaurant or is_platform_wide):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ese cupón no aplica para este comercio")
        if not promotion.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cupón inactivo")
        now = datetime.now(timezone.utc)
        if promotion.starts_at and now < promotion.starts_at:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este cupón todavía no ha empezado")
        if promotion.ends_at and now > promotion.ends_at:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este cupón ya venció")

        already_used = await db.execute(
            select(PromotionRedemption).where(
                PromotionRedemption.promotion_id == promotion.id,
                PromotionRedemption.user_id == current_user.id,
            )
        )
        if already_used.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ya usaste este cupón antes")

        if promotion.discount_type == "percentage":
            discount_amount = round(subtotal * float(promotion.discount_value) / 100, 2)
        else:
            discount_amount = min(float(promotion.discount_value), subtotal + delivery_fee)

    if data.tip_amount > 0 and data.payment_method == "efectivo":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La propina solo está disponible para pagos en línea, no en efectivo",
        )

    total = subtotal + delivery_fee - discount_amount + data.tip_amount

    order = Order(
        customer_id=current_user.id,
        restaurant_id=restaurant.id,
        delivery_address_id=data.delivery_address_id,
        payment_method=data.payment_method,
        payment_status=PaymentStatus.contra_entrega if data.payment_method == "efectivo" else PaymentStatus.pendiente,
        subtotal=subtotal,
        delivery_fee=delivery_fee,
        commission_amount=commission_amount,
        promotion_id=promotion.id if promotion else None,
        discount_amount=discount_amount,
        tip_amount=data.tip_amount,
        total=total,
        notes=data.notes,
        status=OrderStatus.creado,
        items=order_items,
    )
    db.add(order)
    await db.flush()
    db.add(OrderStatusHistory(order_id=order.id, status=OrderStatus.creado, changed_by=current_user.id))
    if promotion:
        db.add(PromotionRedemption(promotion_id=promotion.id, user_id=current_user.id, order_id=order.id))
    await db.commit()
    await db.refresh(order, attribute_names=["items"])

    await manager.publish_to_user(
        str(restaurant.owner_id),
        "order.created",
        {"order_id": str(order.id), "status": order.status.value},
    )
    await notify_user(
        db,
        restaurant.owner_id,
        "Nuevo pedido 🛎️",
        f"Tienes un pedido nuevo por ${total:,.0f}",
        {"order_id": str(order.id), "type": "order.created"},
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

    # Si el pedido es en efectivo, el domiciliario va a recibir plata que no es
    # toda suya. Si ya debe dinero de un pedido en efectivo anterior, no lo
    # dejamos tomar otro hasta que pague esa deuda (para que no se acumule).
    if order.payment_method == "efectivo":
        dp_wallet = await get_or_create_wallet(db, current_user.id)
        if dp_wallet.balance_cents < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tienes una deuda pendiente por efectivo recibido antes. Debes pagarla para poder tomar otro pedido en efectivo.",
            )

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

    await notify_user(
        db,
        order.customer_id,
        "¡Tu pedido va en camino! 🛵",
        "Un domiciliario ya recogió tu pedido y está en camino al comercio.",
        {"order_id": str(order.id), "type": "order.status_changed"},
    )

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
    #
    # OJO con el pago en EFECTIVO: ahí el domiciliario recibe de manos del
    # cliente el pedido completo (subtotal + domicilio), no solo su parte. Por
    # eso, en ese caso, además de acreditarle al comercio su parte como siempre,
    # se le DESCUENTA al domiciliario de su propia billetera el valor del
    # subtotal (que no es suyo: le pertenece al comercio y a la comisión de la
    # plataforma). Si su saldo no alcanza, queda en negativo como una deuda,
    # que se recupera solo con sus próximas ganancias de pedidos pagados en
    # línea, o la puede saldar él mismo transfiriendo el dinero.
    if data.status == OrderStatus.entregado:
        restaurant_for_payout = await db.execute(select(Restaurant).where(Restaurant.id == order.restaurant_id))
        restaurant_obj = restaurant_for_payout.scalar_one_or_none()
        if restaurant_obj:
            # Si el pedido usó un cupón DEL PROPIO comercio, ese descuento lo
            # asume el comercio (se le resta de su pago). Si el cupón fue de
            # la plataforma, el comercio recibe su parte completa, sin
            # afectarlo — el costo del descuento lo asume la plataforma.
            comercio_discount_cents = 0
            if order.promotion_id and float(order.discount_amount) > 0:
                promo_result = await db.execute(select(Promotion).where(Promotion.id == order.promotion_id))
                promo_obj = promo_result.scalar_one_or_none()
                if promo_obj and promo_obj.restaurant_id == restaurant_obj.id:
                    comercio_discount_cents = round(float(order.discount_amount) * 100)

            comercio_share_cents = (
                round((float(order.subtotal) - float(order.commission_amount)) * 100) - comercio_discount_cents
            )
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
                delivery_commission_cents = round(
                    float(order.delivery_fee) * float(dp_obj.commission_rate) / 100 * 100
                )
                order.delivery_commission_amount = delivery_commission_cents / 100

                if order.payment_method == "efectivo":
                    # El domiciliario recibió en efectivo lo que el cliente
                    # pagó de verdad (ya con el descuento del cupón aplicado,
                    # si hubo). Debe devolver la parte de la comida (menos el
                    # descuento, si el cupón se lo restó a esa parte) más la
                    # comisión de la plataforma sobre su propio domicilio.
                    subtotal_after_discount_cents = round((float(order.subtotal) - float(order.discount_amount)) * 100)
                    total_debt_cents = subtotal_after_discount_cents + delivery_commission_cents
                    dp_wallet = await get_or_create_wallet(db, dp_obj.user_id)
                    await debit_wallet(
                        db,
                        dp_wallet,
                        total_debt_cents,
                        f"Efectivo recibido del cliente en pedido #{str(order.id)[:8]} "
                        f"(comida para el comercio + comisión de la plataforma)",
                        order.id,
                    )
                else:
                    domicilio_share_cents = round(float(order.delivery_fee) * 100) - delivery_commission_cents
                    tip_cents = round(float(order.tip_amount) * 100)
                    await credit_wallet(
                        db,
                        dp_obj.user_id,
                        domicilio_share_cents,
                        order.id,
                        f"Domicilio pedido #{str(order.id)[:8]} (comisión de plataforma ya descontada)",
                    )
                    if tip_cents > 0:
                        # La propina es 100% del domiciliario, sin comisión.
                        await credit_wallet(
                            db,
                            dp_obj.user_id,
                            tip_cents,
                            order.id,
                            f"Propina pedido #{str(order.id)[:8]}",
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

    customer_message = ORDER_STATUS_CUSTOMER_MESSAGES.get(order.status)
    if customer_message:
        await notify_user(
            db,
            order.customer_id,
            "Actualización de tu pedido 📦",
            customer_message,
            {"order_id": str(order.id), "type": "order.status_changed"},
        )
    return order
