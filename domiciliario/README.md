# App Domiciliario — Plataforma de Domicilios

App React Native (Expo) para que los repartidores acepten y entreguen pedidos.

## Instalación

```bash
cd domiciliario
npm install
```

## Configuración

Edita `.env` y pon la misma IP local que usaste en `cliente/.env` y `comercio/.env`:

```
EXPO_PUBLIC_API_URL=http://TU_IP_LOCAL:8000
```

## Ejecutar

```bash
npx expo start
```

## Flujo de uso

1. Regístrate como repartidor.
2. Completa tu perfil:
   - Tipo de vehículo (moto, bicicleta, carro, a pie)
   - Placa (si aplica)
   - **Foto de tu documento de identidad** (cámara o galería)
   - **Foto del documento del vehículo** (SOAT/tarjeta de propiedad — solo moto/carro)
   - **Tu selfie** (cámara frontal o una foto que ya tengas)
   Las fotos se suben de una vez al servidor; no puedes continuar sin subirlas.
3. Un administrador debe aprobar tu perfil desde el panel admin (ahí puede ver las 3 fotos antes de aprobar).
4. Una vez aprobado, ve a la pestaña **Perfil** y actívate con el switch "Disponible".
5. En **Disponibles**, verás los pedidos listos para recoger (se actualiza cada 6s). Toca "Aceptar pedido".
6. En **Mis entregas**, avanza el estado paso a paso: en camino al comercio → recogido → en camino al cliente → entregado.
7. Toca un pedido para ver el detalle y chatear con el cliente.

## Requisitos del backend para las fotos

El backend necesita el paquete `httpx` (ya está en `requirements.txt`) y las variables
`SUPABASE_URL` / `SUPABASE_SERVICE_KEY` en `backend/.env` (ya deberían estar configuradas).
Las fotos se guardan en un bucket público de Supabase Storage llamado `domicilios-media`,
que ya fue creado automáticamente.

Si ya tenías el backend instalado antes de esta actualización, corre de nuevo:
```bash
cd backend
venv\Scripts\activate   (o source venv/bin/activate en Mac)
pip install -r requirements.txt
```

## Notas

- El envío de ubicación GPS en vivo no está incluido todavía (el backend ya tiene el endpoint `/api/delivery/location` listo); se añadirá en la fase de geolocalización avanzada con `expo-location`.
