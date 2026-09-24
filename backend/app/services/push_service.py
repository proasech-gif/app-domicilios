"""Envío de notificaciones push usando el servicio de Expo.

Como las 3 apps móviles están hechas con Expo, usamos directamente el servicio
push de Expo (https://exp.host/--/api/v2/push/send) en vez de integrar Firebase
Cloud Messaging manualmente. Expo se encarga por debajo de hablar con Apple
(APNs) y Google (FCM) — nosotros solo necesitamos el "Expo push token" que cada
celular genera, y que las apps registran contra este backend al iniciar sesión.

No requiere ninguna clave secreta ni cuenta externa para funcionar en modo de
pruebas / desarrollo.
"""

import logging
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push_notification(
    tokens: list[str],
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    """Envía una notificación a una lista de Expo push tokens.

    Se ignoran fallos silenciosamente (solo se registran en el log) para que un
    problema de notificaciones nunca tumbe una operación real como crear un
    pedido o cambiar su estado.
    """
    tokens = [t for t in tokens if t and t.startswith("ExponentPushToken")]
    if not tokens:
        return

    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "data": data or {},
            "sound": "default",
            "priority": "high",
        }
        for token in tokens
    ]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
            if response.status_code >= 400:
                logger.warning("Expo push falló (%s): %s", response.status_code, response.text)
    except httpx.HTTPError as exc:
        logger.warning("Error de red enviando push a Expo: %s", exc)


async def notify_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    """Busca el push token guardado de un usuario y le envía una notificación.

    Si el usuario nunca registró un token (o rechazó el permiso), no hace nada.
    """
    result = await db.execute(select(User.expo_push_token).where(User.id == user_id))
    token = result.scalar_one_or_none()
    if not token:
        return
    await send_push_notification([token], title, body, data)
