import asyncio
import json
import logging

import redis.asyncio as aioredis
from fastapi import WebSocket

from app.core.config import settings

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Gestiona conexiones WebSocket agrupadas por pedido (order_id) y por usuario (user_id).

    Usa Redis pub/sub como bus de eventos: cuando el backend corre con varias instancias
    (varios workers/contenedores), un evento publicado desde cualquier instancia llega a
    todos los clientes conectados, sin importar a qué instancia estén conectados.
    """

    def __init__(self) -> None:
        self.order_connections: dict[str, set[WebSocket]] = {}
        self.user_connections: dict[str, set[WebSocket]] = {}
        self._redis: aioredis.Redis | None = None
        self._listener_tasks: dict[str, asyncio.Task] = {}

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    # --- Conexión / desconexión ---

    async def connect_order(self, order_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.order_connections.setdefault(order_id, set()).add(websocket)
        await self._ensure_listener(f"order:{order_id}")

    def disconnect_order(self, order_id: str, websocket: WebSocket) -> None:
        conns = self.order_connections.get(order_id)
        if conns and websocket in conns:
            conns.remove(websocket)
            if not conns:
                del self.order_connections[order_id]

    async def connect_user(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.user_connections.setdefault(user_id, set()).add(websocket)
        await self._ensure_listener(f"user:{user_id}")

    def disconnect_user(self, user_id: str, websocket: WebSocket) -> None:
        conns = self.user_connections.get(user_id)
        if conns and websocket in conns:
            conns.remove(websocket)
            if not conns:
                del self.user_connections[user_id]

    # --- Publicación de eventos ---

    async def publish_to_order(self, order_id: str, event_type: str, payload: dict) -> None:
        try:
            redis = await self._get_redis()
            message = json.dumps({"event": event_type, "order_id": order_id, "payload": payload})
            await redis.publish(f"order:{order_id}", message)
        except Exception:
            # Si Redis no está disponible (ej. en desarrollo local sin Redis instalado),
            # no debe romper la operación principal (crear/actualizar un pedido).
            # Solo se pierde la notificación en vivo, no algo crítico.
            logger.warning("No se pudo publicar en Redis (order:%s) — ¿Redis está corriendo?", order_id)

    async def publish_to_user(self, user_id: str, event_type: str, payload: dict) -> None:
        try:
            redis = await self._get_redis()
            message = json.dumps({"event": event_type, "payload": payload})
            await redis.publish(f"user:{user_id}", message)
        except Exception:
            logger.warning("No se pudo publicar en Redis (user:%s) — ¿Redis está corriendo?", user_id)

    # --- Escucha interna de canales Redis ---

    async def _ensure_listener(self, channel: str) -> None:
        existing = self._listener_tasks.get(channel)
        if existing and not existing.done():
            return
        redis = await self._get_redis()
        pubsub = redis.pubsub()
        await pubsub.subscribe(channel)
        self._listener_tasks[channel] = asyncio.create_task(self._listen(channel, pubsub))

    async def _listen(self, channel: str, pubsub) -> None:
        try:
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                data = message["data"]
                if channel.startswith("order:"):
                    order_id = channel.split(":", 1)[1]
                    for ws in list(self.order_connections.get(order_id, set())):
                        await self._safe_send(ws, data)
                elif channel.startswith("user:"):
                    user_id = channel.split(":", 1)[1]
                    for ws in list(self.user_connections.get(user_id, set())):
                        await self._safe_send(ws, data)
        except asyncio.CancelledError:
            await pubsub.unsubscribe(channel)
            raise
        except Exception:
            logger.exception("Error en el listener de Redis para el canal %s", channel)

    @staticmethod
    async def _safe_send(websocket: WebSocket, data: str) -> None:
        try:
            await websocket.send_text(data)
        except Exception:
            pass  # el cliente probablemente se desconectó; el cleanup ocurre en el endpoint


# Instancia única compartida por toda la aplicación
manager = ConnectionManager()
