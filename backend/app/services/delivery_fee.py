"""Cálculo del valor del domicilio según la distancia real entre el comercio
y la dirección de entrega, con tarifas distintas de día y de noche.

Reglas (definidas por el negocio):
- De día (antes de las 6:00 p.m., hora de Colombia): mínimo $4.000, más
  $1.000 por cada kilómetro adicional después del primero (el primer
  kilómetro va incluido en el mínimo).
- De noche (desde las 6:00 p.m.): mínimo $5.000, más $1.500 por cada
  kilómetro adicional.
"""

import math
from datetime import datetime, timedelta, timezone

# Colombia siempre está en UTC-5, todo el año (no tiene horario de verano),
# así que usamos un huso horario fijo en vez de depender de la librería de
# zonas horarias del sistema operativo (en Windows, "America/Bogota" a veces
# no está disponible sin instalar el paquete adicional "tzdata").
BOGOTA_TZ = timezone(timedelta(hours=-5))

DAY_MINIMUM = 4000.0
DAY_RATE_PER_KM = 1000.0
NIGHT_MINIMUM = 5000.0
NIGHT_RATE_PER_KM = 1500.0
NIGHT_STARTS_AT_HOUR = 18  # 6:00 p.m.

FREE_KM_INCLUDED_IN_MINIMUM = 1.0


def calculate_delivery_fee(distance_km: float, at: datetime | None = None) -> float:
    """Devuelve el valor del domicilio en pesos, ya redondeado.

    `at` es la hora a usar para decidir si aplica tarifa de día o de noche
    (por defecto, la hora actual en Colombia). Se expone como parámetro
    para poder probarlo con horas específicas.
    """
    now = (at or datetime.now(BOGOTA_TZ)).astimezone(BOGOTA_TZ)
    is_night = now.hour >= NIGHT_STARTS_AT_HOUR

    minimum = NIGHT_MINIMUM if is_night else DAY_MINIMUM
    rate_per_km = NIGHT_RATE_PER_KM if is_night else DAY_RATE_PER_KM

    extra_km = max(0.0, distance_km - FREE_KM_INCLUDED_IN_MINIMUM)
    # Un kilómetro que empieza, aunque sea parcial, se cobra completo.
    extra_km_rounded_up = math.ceil(extra_km - 1e-9)

    return minimum + extra_km_rounded_up * rate_per_km
