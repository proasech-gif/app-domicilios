from datetime import datetime
from typing import Literal
import uuid

from pydantic import BaseModel, Field, field_validator, model_validator

BusinessTypeLiteral = Literal["restaurante", "supermercado", "farmacia", "tienda", "mascota", "belleza"]


class PromotionCreate(BaseModel):
    """Usado por el comercio para crear un cupón de SU PROPIO negocio."""
    code: str = Field(min_length=3, max_length=50)
    description: str | None = None
    discount_type: Literal["percentage", "fixed"]
    discount_value: float = Field(gt=0)
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @field_validator("code")
    @classmethod
    def uppercase_code(cls, v: str) -> str:
        return v.strip().upper()


class AdminPromotionCreate(BaseModel):
    """Usado por el administrador para crear un cupón de PLATAFORMA: puede ser
    un descuento para clientes (dirigido a un tipo de negocio, o a todos), o
    un bono para comercios o domiciliarios (nunca para clientes, ya que ellos
    no tienen billetera interna)."""
    code: str = Field(min_length=3, max_length=50)
    description: str | None = None
    discount_type: Literal["percentage", "fixed"]
    discount_value: float = Field(gt=0)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    target_audience: Literal["cliente", "comercio", "domiciliario"] = "cliente"
    target_business_type: BusinessTypeLiteral | None = None

    @field_validator("code")
    @classmethod
    def uppercase_code(cls, v: str) -> str:
        return v.strip().upper()

    @model_validator(mode="after")
    def validate_audience_rules(self) -> "AdminPromotionCreate":
        if self.target_audience in ("comercio", "domiciliario"):
            if self.discount_type != "fixed":
                raise ValueError("Un bono debe ser de tipo 'fixed' (un monto fijo), no porcentaje.")
            if self.target_business_type is not None:
                raise ValueError("Un bono no puede tener un tipo de negocio asociado.")
        return self


class PromotionOut(BaseModel):
    id: uuid.UUID
    restaurant_id: uuid.UUID | None
    code: str | None
    description: str | None
    discount_type: str
    discount_value: float
    starts_at: datetime | None
    ends_at: datetime | None
    is_active: bool
    target_business_type: str | None
    target_audience: str

    class Config:
        from_attributes = True


class PromotionValidateResult(BaseModel):
    valid: bool
    reason: str | None = None
    code: str | None = None
    discount_type: str | None = None
    discount_value: float | None = None


class RedeemBonusResult(BaseModel):
    valid: bool
    reason: str | None = None
    amount_credited_cents: int | None = None
