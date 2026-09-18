import uuid

from pydantic import BaseModel

from app.models.enums import ApprovalStatus, VehicleType


class DeliveryProfileCreate(BaseModel):
    vehicle_type: VehicleType
    vehicle_plate: str | None = None
    id_document_url: str  # foto del documento de identidad (cédula)
    # foto del documento del vehículo (SOAT/tarjeta de propiedad); opcional para bicicleta/a pie
    vehicle_document_url: str | None = None
    selfie_url: str  # foto de perfil / selfie del domiciliario
    license_document_url: str | None = None


class DeliveryLocationUpdate(BaseModel):
    latitude: float
    longitude: float


class DeliveryPersonOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    vehicle_type: VehicleType
    vehicle_plate: str | None
    id_document_url: str | None
    vehicle_document_url: str | None
    selfie_url: str | None
    approval_status: ApprovalStatus
    is_available: bool

    class Config:
        from_attributes = True
