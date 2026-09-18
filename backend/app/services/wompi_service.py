"""Integración con la pasarela de pagos Wompi.

Usamos el "Widget de Checkout" de Wompi: en vez de manejar tarjetas nosotros mismos
(lo cual requeriría certificación PCI), generamos una URL segura que el cliente abre
en su navegador/WebView, Wompi se encarga de cobrar (tarjeta, Nequi, PSE, Bancolombia),
y nos notifica el resultado mediante un webhook.

Documentación: https://docs.wompi.co/docs/colombia/widget-checkout-web/
"""
import hashlib
import uuid
from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import settings

CHECKOUT_BASE_URL = "https://checkout.wompi.co/p/"


def generate_reference(order_id: uuid.UUID) -> str:
    """Genera una referencia única por intento de pago (Wompi exige que sea única)."""
    return f"pedido-{order_id}-{uuid.uuid4().hex[:8]}"


def _integrity_signature(reference: str, amount_in_cents: int, currency: str) -> str:
    """SHA256(referencia + monto_en_centavos + moneda + secreto_de_integridad).

    Este hash evita que alguien manipule el monto o la referencia desde el navegador.
    """
    raw = f"{reference}{amount_in_cents}{currency}{settings.WOMPI_INTEGRITY_SECRET}"
    return hashlib.sha256(raw.encode()).hexdigest()


def build_checkout_url(reference: str, amount_in_cents: int, redirect_url: str, currency: str = "COP") -> str:
    """Arma la URL del Widget de Checkout de Wompi lista para abrir en el navegador."""
    signature = _integrity_signature(reference, amount_in_cents, currency)
    params = {
        "public-key": settings.WOMPI_PUBLIC_KEY,
        "currency": currency,
        "amount-in-cents": str(amount_in_cents),
        "reference": reference,
        "signature:integrity": signature,
        "redirect-url": redirect_url,
    }
    query = urlencode(params)
    return f"{CHECKOUT_BASE_URL}?{query}"


def _get_nested(data: dict[str, Any], path: str) -> Any:
    """Obtiene un valor anidado tipo 'transaction.id' de un diccionario."""
    value: Any = data
    for part in path.split("."):
        value = value[part]
    return value


def verify_webhook_signature(event: dict[str, Any]) -> bool:
    """Valida que el webhook realmente venga de Wompi (evita webhooks falsos).

    Wompi manda, dentro del evento, qué propiedades usar para construir el checksum:
    event.signature.properties es una lista como ["transaction.id", "transaction.status", ...]
    El checksum esperado es SHA256(valores_concatenados + timestamp + secreto_de_eventos).
    """
    try:
        signature_info = event["signature"]
        properties: list[str] = signature_info["properties"]
        received_checksum: str = signature_info["checksum"]
        timestamp = event["timestamp"]

        concatenated = "".join(str(_get_nested(event["data"], prop)) for prop in properties)
        raw = f"{concatenated}{timestamp}{settings.WOMPI_EVENTS_SECRET}"
        expected_checksum = hashlib.sha256(raw.encode()).hexdigest()

        return expected_checksum.lower() == received_checksum.lower()
    except (KeyError, TypeError):
        return False


async def fetch_transaction(wompi_transaction_id: str) -> dict[str, Any] | None:
    """Consulta el estado real de una transacción directamente en la API de Wompi.

    Sirve como respaldo por si el webhook no llega (ej. la app lo consulta manualmente).
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"{settings.WOMPI_API_URL}/transactions/{wompi_transaction_id}",
            headers={"Authorization": f"Bearer {settings.WOMPI_PRIVATE_KEY}"},
        )
    if response.status_code != 200:
        return None
    return response.json().get("data")
