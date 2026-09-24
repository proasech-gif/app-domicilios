from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import auth, users, restaurants, delivery, admin, orders, chat, addresses, uploads, payments, wallet, ratings, reports, promotions
from app.websockets import router as ws_router

app = FastAPI(
    title="API Plataforma de Domicilios",
    version="0.1.0",
    description="Backend para clientes, comercios, domiciliarios y administración",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(restaurants.router)
app.include_router(delivery.router)
app.include_router(admin.router)
app.include_router(orders.router)
app.include_router(chat.router)
app.include_router(addresses.router)
app.include_router(uploads.router)
app.include_router(payments.router)
app.include_router(wallet.router)
app.include_router(ratings.router)
app.include_router(ratings.public_router)
app.include_router(reports.router)
app.include_router(promotions.router)
app.include_router(promotions.promo_router)
app.include_router(promotions.admin_promo_router)
app.include_router(ws_router.router)


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok"}