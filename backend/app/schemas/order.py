import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus


class OrderItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(gt=0)
    notes: str | None = None


class OrderCreate(BaseModel):
    restaurant_id: uuid.UUID
    delivery_address_id: uuid.UUID
    payment_method: PaymentMethod
    items: list[OrderItemCreate] = Field(min_length=1)
    notes: str | None = None


class OrderItemOut(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    quantity: int
    unit_price: float
    notes: str | None

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    restaurant_id: uuid.UUID
    delivery_person_id: uuid.UUID | None
    delivery_address_id: uuid.UUID
    status: OrderStatus
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    subtotal: float
    delivery_fee: float
    commission_amount: float
    total: float
    notes: str | None
    created_at: datetime
    items: list[OrderItemOut] = []

    class Config:
        from_attributes = True


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
