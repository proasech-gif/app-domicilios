import base64
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models.user import User
from app.services.storage import upload_image, upload_image_bytes

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("/image")
async def upload_image_endpoint(
    current_user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
):
    """Sube una imagen (foto de documento, selfie, producto, etc.) y devuelve su URL pública.

    La carpeta de destino se organiza por rol y usuario para mantener orden:
    domicilios-media/{rol}/{user_id}/{uuid}.{ext}
    """
    folder = f"{current_user.role.value}/{current_user.id}"
    url = await upload_image(file, folder)
    return {"url": url}


class Base64ImageUpload(BaseModel):
    filename: str
    content_type: str  # ej: "image/jpeg"
    data_base64: str  # contenido del archivo codificado en base64 (sin el prefijo data:...;base64,)


@router.post("/image-base64")
async def upload_image_base64_endpoint(
    data: Base64ImageUpload,
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Igual que /image, pero recibe la foto como texto base64 dentro de un JSON normal
    en vez de multipart/form-data. Se usa desde apps móviles para evitar problemas de
    compatibilidad de FormData/multipart en algunas versiones de React Native/Android."""
    try:
        body = base64.b64decode(data.data_base64)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo base64 es inválido")

    folder = f"{current_user.role.value}/{current_user.id}"
    url = await upload_image_bytes(body, data.content_type, folder)
    return {"url": url}
