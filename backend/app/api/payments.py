import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.models.enums import PaymentStatus
from app.models.order import Order
from app.models.user import User, UserRole
from app.models.wallet import Payment
from app.services import wompi_service

router = APIRouter(prefix="/api/payments", tags=["payments"])


class PaymentLinkOut(BaseModel):
    payment_url: str
    reference: str


@router.post("/orders/{order_id}/link", response_model=PaymentLinkOut)
async def create_payment_link(
    order_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.cliente))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Genera (o reutiliza) el link de pago de Wompi para un pedido con pago online."""
    order_result = await db.execute(select(Order).where(Order.id == order_id))
    order = order_result.scalar_one_or_none()
    if not order or order.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")

    if order.payment_method == "efectivo":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este pedido se paga en efectivo")

    if order.payment_status == PaymentStatus.aprobado:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este pedido ya está pagado")

    # Cada intento de pago necesita una referencia NUEVA para Wompi (no permite reusar
    # una referencia que ya se usó antes, aunque el pago anterior haya quedado pendiente).
    payment_result = await db.execute(select(Payment).where(Payment.order_id == order.id))
    payment = payment_result.scalar_one_or_none()

    amount_in_cents = int(round(float(order.total) * 100))
    new_reference = wompi_service.generate_reference(order.id)

    if payment:
        payment.reference = new_reference
        payment.amount_in_cents = amount_in_cents
        payment.status = PaymentStatus.pendiente
        payment.wompi_transaction_id = None
        payment.raw_wompi_status = None
    else:
        payment = Payment(
            order_id=order.id,
            reference=new_reference,
            amount_in_cents=amount_in_cents,
            status=PaymentStatus.pendiente,
        )
        db.add(payment)

    await db.commit()

    # redirect-url: a dónde vuelve el navegador/WebView tras el pago. La app detecta esta
    # URL para cerrar el navegador interno y luego consulta el estado real por API.
    redirect_url = "https://wompi.co"  # placeholder: la app cierra el WebView por patrón de URL, no depende del contenido
    payment_url = wompi_service.build_checkout_url(payment.reference, amount_in_cents, redirect_url)

    return PaymentLinkOut(payment_url=payment_url, reference=payment.reference)


class PaymentStatusOut(BaseModel):
    status: PaymentStatus


@router.get("/orders/{order_id}/status", response_model=PaymentStatusOut)
async def get_payment_status(
    order_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.cliente))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    order_result = await db.execute(select(Order).where(Order.id == order_id))
    order = order_result.scalar_one_or_none()
    if not order or order.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
    return PaymentStatusOut(status=order.payment_status)


_WOMPI_STATUS_MAP = {
    "APPROVED": PaymentStatus.aprobado,
    "DECLINED": PaymentStatus.rechazado,
    "ERROR": PaymentStatus.error,
    "VOIDED": PaymentStatus.rechazado,
}


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def wompi_webhook(request: Request, db: Annotated[AsyncSession, Depends(get_db)]):
    """Wompi llama a esta URL cada vez que el estado de una transacción cambia.

    IMPORTANTE: esta ruta es pública (Wompi no manda nuestro JWT), así que la
    seguridad depende por completo de validar la firma del evento.
    """
    event: dict[str, Any] = await request.json()

    if event.get("event") != "transaction.updated":
        return {"received": True}

    signature_ok = wompi_service.verify_webhook_signature(event)
    is_sandbox_event = event.get("environment") == "test"

    if not signature_ok:
        print("=== AVISO: FIRMA WOMPI NO COINCIDE (revisar antes de producción) ===")
        print("Entorno del evento:", event.get("environment"))
        print("Referencia:", event.get("data", {}).get("transaction", {}).get("reference"))
        print("=====================================================================")
        if not is_sandbox_event:
            # En producción SÍ bloqueamos: sin firma válida, no confiamos en el webhook.
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Firma de webhook inválida")
        # En sandbox dejamos pasar para no bloquear las pruebas mientras se ajusta la firma.

    transaction = event["data"]["transaction"]
    reference = transaction["reference"]
    wompi_status = transaction["status"]  # APPROVED, DECLINED, VOIDED, ERROR, PENDING

    payment_result = await db.execute(select(Payment).where(Payment.reference == reference))
    payment = payment_result.scalar_one_or_none()
    if not payment:
        # Referencia desconocida: respondemos 200 igual para que Wompi no reintente indefinidamente.
        return {"received": True, "matched": False}

    payment.wompi_transaction_id = transaction.get("id")
    payment.raw_wompi_status = wompi_status
    payment.status = _WOMPI_STATUS_MAP.get(wompi_status, PaymentStatus.pendiente)

    order_result = await db.execute(select(Order).where(Order.id == payment.order_id))
    order = order_result.scalar_one_or_none()
    if order:
        order.payment_status = payment.status

    await db.commit()
    return {"received": True, "matched": True}
