import json
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import decode_token
from app.models.chat import ChatMessage
from app.models.delivery_person import DeliveryPerson
from app.models.order import Order
from app.models.restaurant import Restaurant
from app.models.user import User, UserRole
from app.services.push_service import notify_user
from app.websockets.manager import manager

router = APIRouter(tags=["websockets"])


async def _authenticate_ws(websocket: WebSocket) -> User | None:
    """Autentica el WebSocket usando un JWT pasado como query param ?token=...."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError
    except ValueError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == payload["sub"]))
        user = result.scalar_one_or_none()
    if not user or not user.is_active:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None
    return user


async def _user_can_access_order(user: User, order_id: uuid.UUID, db) -> bool:
    if user.role == UserRole.admin:
        return True
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        return False
    if user.role == UserRole.cliente:
        return order.customer_id == user.id
    if user.role == UserRole.comercio:
        r = await db.execute(select(Restaurant).where(Restaurant.id == order.restaurant_id))
        restaurant = r.scalar_one_or_none()
        return bool(restaurant and restaurant.owner_id == user.id)
    if user.role == UserRole.domiciliario:
        dp = await db.execute(select(DeliveryPerson).where(DeliveryPerson.user_id == user.id))
        profile = dp.scalar_one_or_none()
        return bool(profile and order.delivery_person_id == profile.id)
    return False


async def _order_participant_user_ids(order: Order, db) -> set[uuid.UUID]:
    """IDs de los usuarios involucrados en un pedido: cliente, dueño del comercio
    y domiciliario asignado (si ya hay uno)."""
    ids = {order.customer_id}
    r = await db.execute(select(Restaurant).where(Restaurant.id == order.restaurant_id))
    restaurant = r.scalar_one_or_none()
    if restaurant:
        ids.add(restaurant.owner_id)
    if order.delivery_person_id:
        dp = await db.execute(select(DeliveryPerson).where(DeliveryPerson.id == order.delivery_person_id))
        profile = dp.scalar_one_or_none()
        if profile:
            ids.add(profile.user_id)
    return ids


@router.websocket("/ws/orders/{order_id}")
async def order_socket(websocket: WebSocket, order_id: uuid.UUID):
    """
    Canal en tiempo real de un pedido: ubicación del domiciliario, cambios de estado y chat.
    Conexión: wss://.../ws/orders/{order_id}?token=<access_token>
    Mensajes entrantes esperados (JSON): {"type": "chat.message", "message": "..."}
    """
    user = await _authenticate_ws(websocket)
    if user is None:
        return

    async with AsyncSessionLocal() as db:
        authorized = await _user_can_access_order(user, order_id, db)
    if not authorized:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    order_key = str(order_id)
    await manager.connect_order(order_key, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if data.get("type") == "chat.message":
                text = (data.get("message") or "").strip()
                if not text:
                    continue
                async with AsyncSessionLocal() as db:
                    chat_message = ChatMessage(order_id=order_id, sender_id=user.id, message=text)
                    db.add(chat_message)
                    await db.commit()
                    await db.refresh(chat_message)

                await manager.publish_to_order(
                    order_key,
                    "chat.message",
                    {
                        "id": str(chat_message.id),
                        "sender_id": str(user.id),
                        "sender_role": user.role.value,
                        "message": text,
                        "sent_at": chat_message.sent_at.isoformat(),
                    },
                )

                # Avisar por push a los demás participantes del pedido (no al que envió).
                async with AsyncSessionLocal() as db:
                    order_result = await db.execute(select(Order).where(Order.id == order_id))
                    order_for_push = order_result.scalar_one_or_none()
                    if order_for_push:
                        participant_ids = await _order_participant_user_ids(order_for_push, db)
                        participant_ids.discard(user.id)
                        preview = text if len(text) <= 80 else text[:77] + "..."
                        for recipient_id in participant_ids:
                            await notify_user(
                                db,
                                recipient_id,
                                f"Mensaje sobre tu pedido 💬",
                                preview,
                                {"order_id": str(order_id), "type": "chat.message"},
                            )
            # otros tipos de mensaje entrante pueden añadirse aquí (ej. "typing")
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect_order(order_key, websocket)


@router.websocket("/ws/notifications")
async def notifications_socket(websocket: WebSocket):
    """
    Canal personal de notificaciones (cambios de estado de cualquier pedido propio, avisos del admin, etc).
    Conexión: wss://.../ws/notifications?token=<access_token>
    """
    user = await _authenticate_ws(websocket)
    if user is None:
        return

    user_key = str(user.id)
    await manager.connect_user(user_key, websocket)
    try:
        while True:
            # Este canal es principalmente de salida (servidor -> cliente); se mantiene
            # el receive() para detectar la desconexión y permitir pings del cliente.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect_user(user_key, websocket)
