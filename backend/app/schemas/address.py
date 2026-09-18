import uuid

from pydantic import BaseModel, Field


class AddressCreate(BaseModel):
    label: str | None = None
    address_line: str = Field(min_length=3)
    details: str | None = None
    latitude: float
    longitude: float
    is_default: bool = False


class AddressOut(BaseModel):
    id: uuid.UUID
    label: str | None
    address_line: str
    details: str | None
    is_default: bool

    class Config:
        from_attributes = True
