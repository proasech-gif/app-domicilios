# Panel Admin — Plataforma de Domicilios

Next.js 14 (App Router) + TypeScript + Tailwind. Consume directamente la API del backend FastAPI.

## Instalación local

```bash
npm install
cp .env.local.example .env.local
# edita NEXT_PUBLIC_API_URL para que apunte a tu backend
npm run dev
```

Abre `http://localhost:3000` — te redirige a `/login`.

## Qué incluye

| Página | Ruta | Qué hace |
|---|---|---|
| Login | `/login` | Autentica contra `/api/auth/login`; solo funciona con usuarios de rol `admin` (el backend rechaza los demás roles en `/api/admin/*`) |
| Resumen | `/dashboard` | Estadísticas generales (`/api/admin/stats`) |
| Comercios | `/dashboard/restaurantes` | Aprobar/rechazar comercios pendientes |
| Domiciliarios | `/dashboard/domiciliarios` | Aprobar/rechazar domiciliarios pendientes |
| Pedidos | `/dashboard/pedidos` | Vista global de pedidos, con filtro por estado (se refresca cada 15s) |
| Usuarios | `/dashboard/usuarios` | Suspender/reactivar cualquier cuenta |

La sesión se guarda como JWT en `localStorage`; cualquier respuesta 401 del backend cierra la sesión automáticamente y redirige a `/login`.

## Desplegar en Vercel

1. Sube este directorio (`admin-panel/`) a un repositorio de GitHub, o usa `vercel --prod` desde aquí con la CLI de Vercel.
2. En el proyecto de Vercel, configura la variable de entorno **`NEXT_PUBLIC_API_URL`** apuntando a la URL pública de tu backend (Render, Railway, Fly.io, etc. — ver nota abajo).
3. Deploy.

## Nota importante sobre dónde vive el backend

Este panel es solo el frontend. El backend (FastAPI + WebSockets) **no se despliega en Vercel** — Vercel es serverless y no soporta bien conexiones WebSocket persistentes de larga duración. Para producción, el backend necesita un host que mantenga procesos vivos, por ejemplo:

- Render (Web Service)
- Railway
- Fly.io
- Una VPS con Docker + Nginx

En cuanto el backend esté desplegado en cualquiera de esas opciones, solo necesitas apuntar `NEXT_PUBLIC_API_URL` a esa URL pública y el panel funciona contra datos reales.

## Siguiente fase

- App Cliente (React Native)
- App Comercio y App Domiciliario (React Native)
- Cálculo de tarifa por distancia real, notificaciones push (FCM), calificaciones y reportes en el backend
