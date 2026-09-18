from fastapi import HTTPException, status

from app.models.enums import OrderStatus
from app.models.user import UserRole

# Para cada estado ACTUAL, qué estados siguientes son válidos y qué rol puede ejecutar la transición.
# 'sistema' = se ejecuta mediante un endpoint específico (ej. asignación de domiciliario), no por PATCH genérico.
TRANSITIONS: dict[OrderStatus, dict[OrderStatus, set[UserRole]]] = {
    OrderStatus.creado: {
        OrderStatus.confirmado_comercio: {UserRole.comercio},
        OrderStatus.cancelado: {UserRole.comercio, UserRole.cliente, UserRole.admin},
    },
    OrderStatus.confirmado_comercio: {
        OrderStatus.en_preparacion: {UserRole.comercio},
        OrderStatus.cancelado: {UserRole.comercio, UserRole.admin},
    },
    OrderStatus.en_preparacion: {
        OrderStatus.listo_para_recoger: {UserRole.comercio},
        OrderStatus.cancelado: {UserRole.comercio, UserRole.admin},
    },
    OrderStatus.listo_para_recoger: {
        OrderStatus.cancelado: {UserRole.admin},
        # domiciliario_asignado se hace vía POST /orders/{id}/assign-delivery, no aquí
    },
    OrderStatus.domiciliario_asignado: {
        OrderStatus.en_camino_a_comercio: {UserRole.domiciliario},
        OrderStatus.cancelado: {UserRole.admin},
    },
    OrderStatus.en_camino_a_comercio: {
        OrderStatus.recogido: {UserRole.domiciliario},
    },
    OrderStatus.recogido: {
        OrderStatus.en_camino_a_cliente: {UserRole.domiciliario},
    },
    OrderStatus.en_camino_a_cliente: {
        OrderStatus.entregado: {UserRole.domiciliario},
    },
    OrderStatus.entregado: {},
    OrderStatus.cancelado: {},
}


def validate_transition(current: OrderStatus, new: OrderStatus, role: UserRole) -> None:
    allowed = TRANSITIONS.get(current, {})
    allowed_roles = allowed.get(new)
    if allowed_roles is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede pasar de '{current.value}' a '{new.value}'",
        )
    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tu rol no puede realizar la transición '{current.value}' → '{new.value}'",
        )
