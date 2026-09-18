# Backend — Plataforma de Domicilios

FastAPI + PostgreSQL (PostGIS) + JWT.

## Instalación local

```bash
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Configuración

Crea un archivo `.env` en `backend/` (usa el esquema de `app/core/config.py` como referencia):

```
DATABASE_URL=postgresql+asyncpg://usuario:password@localhost:5432/domicilios
SECRET_KEY=genera-una-clave-segura-aqui
REDIS_URL=redis://localhost:6379/0
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu-service-key
```

## Base de datos

Ejecuta `schema.sql` (entregado en la fase anterior) contra tu instancia de PostgreSQL/Supabase con PostGIS habilitado:

```bash
psql "$DATABASE_URL" -f ../schema.sql
```

(Las migraciones con Alembic se añadirán en cuanto el modelo se estabilice; por ahora el schema.sql es la fuente de verdad.)

## Ejecutar el servidor

```bash
uvicorn app.main:app --reload --port 8000
```

Documentación interactiva: `http://localhost:8000/docs`

## Endpoints implementados hasta ahora

### Autenticación
| Método | Ruta | Descripción | Rol requerido |
|---|---|---|---|
| POST | /api/auth/register | Registro de cliente/comercio/domiciliario | Público |
| POST | /api/auth/login | Login, devuelve access + refresh token | Público |
| POST | /api/auth/refresh | Renueva tokens | Público (con refresh token) |
| GET | /api/users/me | Perfil del usuario autenticado | Cualquier usuario autenticado |

### Comercios / productos
| Método | Ruta | Descripción | Rol requerido |
|---|---|---|---|
| POST | /api/restaurants | Crear comercio (queda pendiente de aprobación) | comercio |
| GET | /api/restaurants | Listar comercios aprobados (público) | Público |
| GET | /api/restaurants/mine | Mis comercios | comercio |
| GET | /api/restaurants/{id} | Detalle de un comercio | Público |
| PATCH | /api/restaurants/{id} | Editar comercio propio | comercio (dueño) |
| PATCH | /api/restaurants/{id}/toggle-open | Abrir/cerrar comercio | comercio (dueño, aprobado) |
| POST/GET | /api/restaurants/{id}/categories | Crear/listar categorías | comercio (dueño) / público |
| POST/GET | /api/restaurants/{id}/products | Crear/listar productos | comercio (dueño) / público |
| PATCH | /api/restaurants/products/{id} | Editar producto | comercio (dueño) |

### Domiciliarios
| Método | Ruta | Descripción | Rol requerido |
|---|---|---|---|
| POST | /api/delivery/profile | Completar perfil (vehículo, documentos) — queda pendiente | domiciliario |
| GET | /api/delivery/profile/me | Ver mi perfil | domiciliario |
| PATCH | /api/delivery/availability | Activarse/desactivarse (requiere aprobación) | domiciliario |
| PATCH | /api/delivery/location | Actualizar ubicación actual | domiciliario |

### Pedidos
| Método | Ruta | Descripción | Rol requerido |
|---|---|---|---|
| POST | /api/orders | Crear pedido (calcula subtotal, comisión, total) | cliente |
| GET | /api/orders/mine | Historial del cliente | cliente |
| GET | /api/orders/restaurant/{id} | Pedidos de un comercio | comercio (dueño) |
| GET | /api/orders/available-for-pickup | Pedidos listos sin domiciliario asignado | domiciliario |
| GET | /api/orders/{id} | Detalle de un pedido | cliente/comercio/domiciliario/admin involucrados |
| POST | /api/orders/{id}/assign-delivery | Domiciliario disponible toma el pedido | domiciliario (aprobado, disponible) |
| PATCH | /api/orders/{id}/status | Cambiar estado (valida transición y rol) | según el estado |

### Administración
| Método | Ruta | Descripción |
|---|---|---|
| GET/PATCH | /api/admin/restaurants/pending, /{id}/approve, /{id}/reject, /{id}/suspend | Gestión de aprobación de comercios |
| GET/PATCH | /api/admin/delivery-persons/pending, /{id}/approve, /{id}/reject | Gestión de aprobación de domiciliarios |
| PATCH | /api/admin/users/{id}/suspend, /{id}/reactivate | Suspender/reactivar cualquier usuario |

La máquina de estados de pedidos (`app/services/order_service.py`) valida qué transición es válida y qué rol puede ejecutarla — por ejemplo, un cliente no puede marcar un pedido como "entregado", y un comercio no puede saltarse "en_preparacion".

## Próximos pasos (siguiente fase)

- Cálculo real de tarifa de domicilio por distancia (PostGIS `ST_Distance`)
- Endpoints de calificaciones, reportes y promociones
- Migraciones con Alembic
- Notificaciones push (FCM) disparadas desde los mismos eventos WebSocket

## WebSockets (tiempo real)

Dos canales, autenticados con el mismo JWT de acceso pasado como query param `?token=`:

### `wss://.../ws/orders/{order_id}?token=<access_token>`
Canal por pedido. Solo pueden conectarse: el cliente dueño, el comercio dueño, el domiciliario asignado, o un admin.

**Eventos que emite el servidor:**
- `order.status_changed` — cada vez que cambia el estado del pedido
- `driver.location_updated` — ubicación en vivo del domiciliario (mientras el pedido está en curso)
- `chat.message` — nuevo mensaje de chat

**Mensajes que el cliente puede enviar:**
```json
{"type": "chat.message", "message": "Ya estoy en la puerta"}
```
Cada mensaje de chat se persiste en `chat_messages` (histórico disponible también vía `GET /api/orders/{id}/messages`).

### `wss://.../ws/notifications?token=<access_token>`
Canal personal del usuario autenticado. Recibe `order.status_changed` y `order.created` para cualquier pedido en el que esté involucrado — útil para mostrar notificaciones incluso cuando el usuario no tiene abierta la pantalla de un pedido específico.

### Escalabilidad
El `ConnectionManager` (`app/websockets/manager.py`) usa **Redis pub/sub**: cada evento se publica en un canal Redis (`order:{id}` o `user:{id}`) y cada instancia del backend escucha esos canales, así que funciona correctamente aunque el backend corra con múltiples workers o contenedores detrás de un balanceador de carga — no depende de que el emisor y el receptor estén conectados a la misma instancia.

> Nota: en este entorno de desarrollo no hay acceso a red para instalar dependencias ni ejecutar el servidor; todo el código fue verificado con `python -m py_compile` (sintaxis correcta) pero no se ejecutó end-to-end. Pruébalo localmente con `uvicorn app.main:app --reload` antes de desplegarlo.
