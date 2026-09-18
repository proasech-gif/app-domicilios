import uuid
from datetime import time

from pydantic import BaseModel, Field

from app.models.enums import ApprovalStatus, BusinessType


class RestaurantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    business_type: BusinessType = BusinessType.restaurante
    description: str | None = None
    address_line: str
    latitude: float
    longitude: float
    opens_at: time | None = None
    closes_at: time | None = None


class RestaurantUpdate(BaseModel):
    name: str | None = None
    business_type: BusinessType | None = None
    description: str | None = None
    logo_url: str | None = None
    cover_photo_url: str | None = None
    opens_at: time | None = None
    closes_at: time | None = None


class RestaurantOut(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    business_type: BusinessType
    description: str | None
    logo_url: str | None
    cover_photo_url: str | None
    address_line: str
    approval_status: ApprovalStatus
    is_open: bool
    opens_at: time | None
    closes_at: time | None

    class Config:
        from_attributes = True


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    display_order: int = 0


class CategoryOut(BaseModel):
    id: uuid.UUID
    restaurant_id: uuid.UUID
    name: str
    display_order: int

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    price: float = Field(gt=0)
    category_id: uuid.UUID | None = None
    photo_url: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = Field(default=None, gt=0)
    category_id: uuid.UUID | None = None
    photo_url: str | None = None
    is_available: bool | None = None


class ProductOut(BaseModel):
    id: uuid.UUID
    restaurant_id: uuid.UUID
    category_id: uuid.UUID | None
    name: str
    description: str | None
    price: float
    photo_url: str | None
    is_available: bool

    class Config:
        from_attributes = True
