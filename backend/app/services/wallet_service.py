import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.wallet import Wallet, WalletTransaction
from app.models.enums import WalletTransactionType


async def get_or_create_wallet(db: AsyncSession, user_id: uuid.UUID) -> Wallet:
    result = await db.execute(select(Wallet).where(Wallet.user_id == user_id))
    wallet = result.scalar_one_or_none()
    if wallet:
        return wallet
    wallet = Wallet(user_id=user_id, balance_cents=0)
    db.add(wallet)
    await db.flush()
    return wallet


async def credit_wallet(
    db: AsyncSession,
    user_id: uuid.UUID,
    amount_cents: int,
    order_id: uuid.UUID | None,
    description: str,
) -> Wallet:
    """Abona dinero a la billetera de un usuario (comercio o domiciliario) y deja registro."""
    if amount_cents <= 0:
        wallet = await get_or_create_wallet(db, user_id)
        return wallet

    wallet = await get_or_create_wallet(db, user_id)
    wallet.balance_cents += amount_cents
    db.add(
        WalletTransaction(
            wallet_id=wallet.id,
            order_id=order_id,
            type=WalletTransactionType.credito,
            amount_cents=amount_cents,
            description=description,
        )
    )
    return wallet


async def debit_wallet(
    db: AsyncSession,
    wallet: Wallet,
    amount_cents: int,
    description: str,
    order_id: uuid.UUID | None = None,
) -> None:
    """Descuenta saldo de una billetera (usado al completar un retiro)."""
    wallet.balance_cents -= amount_cents
    db.add(
        WalletTransaction(
            wallet_id=wallet.id,
            order_id=order_id,
            type=WalletTransactionType.debito,
            amount_cents=amount_cents,
            description=description,
        )
    )
