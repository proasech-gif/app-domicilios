import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.core.database import get_db
from app.models.address import Address
from app.models.user import User, UserRole
from app.schemas.address import AddressCreate, AddressOut
from app.services.geo import make_point

router = APIRouter(prefix="/api/addresses", tags=["addresses"])


@router.post("", response_model=AddressOut, status_code=status.HTTP_201_CREATED)
async def create_address(
    data: AddressCreate,
    current_user: Annotated[User, Depends(require_role(UserRole.cliente))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if data.is_default:
        await db.execute(
            Address.__table__.update()
            .where(Address.user_id == current_user.id)
            .values(is_default=False)
        )

    address = Address(
        user_id=current_user.id,
        label=data.label,
        address_line=data.address_line,
        details=data.details,
        location=make_point(data.latitude, data.longitude),
        is_default=data.is_default,
    )
    db.add(address)
    await db.commit()
    await db.refresh(address)
    return address


@router.get("", response_model=list[AddressOut])
async def list_my_addresses(
    current_user: Annotated[User, Depends(require_role(UserRole.cliente))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Address).where(Address.user_id == current_user.id).order_by(Address.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_address(
    address_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_role(UserRole.cliente))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Address).where(Address.id == address_id))
    address = result.scalar_one_or_none()
    if not address or address.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dirección no encontrada")
    await db.delete(address)
    await db.commit()