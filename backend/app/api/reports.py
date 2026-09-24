from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReportOut

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("", response_model=ReportOut, status_code=201)
async def create_report(
    data: ReportCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Cualquier usuario autenticado (cliente, comercio o domiciliario) puede
    reportar un problema, opcionalmente ligado a un pedido específico."""
    report = Report(
        order_id=data.order_id,
        reported_by=current_user.id,
        reason=data.reason,
        description=data.description,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@router.get("/mine", response_model=list[ReportOut])
async def my_reports(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Report).where(Report.reported_by == current_user.id).order_by(Report.created_at.desc())
    )
    return result.scalars().all()
