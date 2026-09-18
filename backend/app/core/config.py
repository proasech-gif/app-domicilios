from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Base de datos
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/domicilios"

    # Seguridad / JWT
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Redis (pub/sub para WebSockets)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Storage (Supabase)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = "domicilios-media"

    # Notificaciones push
    FCM_SERVER_KEY: str = ""

    # Pasarela de pagos (Wompi)
    WOMPI_PUBLIC_KEY: str = ""
    WOMPI_PRIVATE_KEY: str = ""
    WOMPI_EVENTS_SECRET: str = ""
    WOMPI_INTEGRITY_SECRET: str = ""
    WOMPI_API_URL: str = "https://sandbox.wompi.co/v1"  # cambiar a https://production.wompi.co/v1 en producción

    # CORS
    ALLOWED_ORIGINS: list[str] = ["*"]


settings = Settings()
