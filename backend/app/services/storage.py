"""Subida de archivos (fotos/documentos) a Supabase Storage.

Usa la Storage REST API de Supabase directamente con la Service Key,
que tiene permiso total sobre el bucket sin depender de políticas RLS.
"""
import uuid

import httpx
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
_MAX_SIZE_BYTES = 8 * 1024 * 1024  # 8 MB


async def upload_image_bytes(body: bytes, content_type: str, folder: str) -> str:
    """Sube bytes de imagen ya en memoria al bucket configurado y devuelve su URL pública."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="El almacenamiento de archivos no está configurado en el servidor",
        )

    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de imagen no soportado. Usa JPG, PNG o WEBP.",
        )

    if len(body) > _MAX_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La imagen no puede pesar más de 8MB")

    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    object_path = f"{folder}/{uuid.uuid4()}.{ext}"

    upload_url = (
        f"{settings.SUPABASE_URL}/storage/v1/object/{settings.SUPABASE_STORAGE_BUCKET}/{object_path}"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            upload_url,
            content=body,
            headers={
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Content-Type": content_type,
                "x-upsert": "true",
            },
        )

    if response.status_code not in (200, 201):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No se pudo subir la imagen al almacenamiento ({response.status_code})",
        )

    public_url = (
        f"{settings.SUPABASE_URL}/storage/v1/object/public/"
        f"{settings.SUPABASE_STORAGE_BUCKET}/{object_path}"
    )
    return public_url


async def upload_image(file: UploadFile, folder: str) -> str:
    """Sube una imagen (recibida como UploadFile/multipart) y devuelve su URL pública."""
    content_type = file.content_type or "image/jpeg"
    body = await file.read()
    return await upload_image_bytes(body, content_type, folder)
