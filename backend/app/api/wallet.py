import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.models.enums import WithdrawalStatus
from app.models.user import User, UserRole
from app.models.wallet import Wallet, WalletTransaction, WithdrawalRequest
from app.services.wallet_service import get_or_create_wallet

router = APIRouter(prefix="/api/wallet", tags=["wallet"])


class WalletTransactionOut(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID | None
    type: str
    amount_cents: int
    description: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class WalletOut(BaseModel):
    balance_cents: int
    transactions: list[WalletTransactionOut]


@router.get("/me", response_model=WalletOut)
async def my_wallet(
    current_user: Annotated[User, Depends(require_role(UserRole.comercio, UserRole.domiciliario))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    wallet = await get_or_create_wallet(db, current_user.id)
    await db.commit()

    tx_result = await db.execute(
        select(WalletTransaction)
        .where(WalletTransaction.wallet_id == wallet.id)
        .order_by(WalletTransaction.created_at.desc())
        .limit(50)
    )
    transactions = tx_result.scalars().all()
    return WalletOut(balance_cents=wallet.balance_cents, transactions=transactions)


class WithdrawalCreate(BaseModel):
    amount_cents: int = Field(gt=0)
    bank_info: str = Field(min_length=5)


class WithdrawalOut(BaseModel):
    id: uuid.UUID
    amount_cents: int
    bank_info: str
    status: WithdrawalStatus
    requested_at: datetime
    processed_at: datetime | None

    class Config:
        from_attributes = True


@router.post("/withdrawals", response_model=WithdrawalOut, status_code=status.HTTP_201_CREATED)
async def request_withdrawal(
    data: WithdrawalCreate,
    current_user: Annotated[User, Depends(require_role(UserRole.comercio, UserRole.domiciliario))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    wallet = await get_or_create_wallet(db, current_user.id)

    # No permitir pedir más de lo disponible, restando también lo que ya está pendiente de retirar.
    pending_result = await db.execute(
        select(WithdrawalRequest).where(
            WithdrawalRequest.wallet_id == wallet.id, WithdrawalRequest.status == WithdrawalStatus.pendiente
        )
    )
    pending_total = sum(w.amount_cents for w in pending_result.scalars().all())

    if data.amount_cents > (wallet.balance_cents - pending_total):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No tienes suficiente saldo disponible")

    withdrawal = WithdrawalRequest(wallet_id=wallet.id, amount_cents=data.amount_cents, bank_info=data.bank_info)
    db.add(withdrawal)
    await db.commit()
    await db.refresh(withdrawal)
    return withdrawal


@router.get("/withdrawals/mine", response_model=list[WithdrawalOut])
async def my_withdrawals(
    current_user: Annotated[User, Depends(require_role(UserRole.comercio, UserRole.domiciliario))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    wallet = await get_or_create_wallet(db, current_user.id)
    await db.commit()
    result = await db.execute(
        select(WithdrawalRequest)
        .where(WithdrawalRequest.wallet_id == wallet.id)
        .order_by(WithdrawalRequest.requested_at.desc())
    )
    return result.scalars().all()
