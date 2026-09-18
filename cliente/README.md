# App Cliente — Plataforma de Domicilios

Hecha con **Expo** (React Native + expo-router). Se prueba directo en tu celular con la app **Expo Go**, sin instalar Android Studio ni Xcode.

## Qué incluye

- Registro e inicio de sesión (rol `cliente`)
- Explorar comercios abiertos
- Ver menú de un comercio, agregar productos al carrito
- Carrito con selección/creación de dirección de entrega y método de pago
- Crear pedido real contra el backend
- Historial de pedidos
- Seguimiento de un pedido en tiempo real (estado + chat) vía WebSocket
- Perfil y cerrar sesión

## Requisitos antes de instalar

1. **Node.js** ya lo tienes instalado (lo usaste para el panel admin).
2. **Backend corriendo** — debe estar levantado con `uvicorn app.main:app --reload --port 8000` (como ya lo tienes).
3. **App "Expo Go"** instalada en tu celular (Android: Google Play Store; iPhone: App Store) — es gratis.
4. Tu **celular y tu computadora deben estar en la misma red WiFi**.

## Instalación

```bash
cd apps/cliente
npm install
```

## Configurar la URL del backend

1. Copia `.env.example` a `.env`.
2. Averigua la IP de red local de tu computador:
   - Windows: abre una terminal y escribe `ipconfig`, busca "Dirección IPv4" (algo como `192.168.1.185`).
3. En `.env`, reemplaza la IP por la tuya:
   ```
   EXPO_PUBLIC_API_URL=http://TU_IP_AQUI:8000
   ```
   **NO uses `localhost`** — el celular no sabe que "localhost" significa tu computadora.

## Ejecutar

```bash
npx expo start
```

Esto muestra un código QR en la terminal.

- **Android**: abre la app Expo Go → "Scan QR code" → apunta al código.
- **iPhone**: abre la cámara nativa del iPhone → apunta al código → toca la notificación que aparece (te lleva a Expo Go).

La app se abre en tu celular. Cualquier cambio que yo haga en el código se refleja solo con recargar (sacude el celular → "Reload", o guarda el archivo y espera el "Fast Refresh" automático).

## Sobre las direcciones (importante, limitación temporal)

Por ahora, cuando agregas una dirección nueva en el carrito, se guarda con una ubicación de referencia fija (no la ubicación real del mapa) — todavía no integramos selección de ubicación en mapa ni geocodificación de la dirección escrita. Esto significa que el cálculo de distancia/tarifa de domicilio no será preciso todavía. Se puede agregar en una siguiente fase con Google Maps o Mapbox.

## Siguiente fase

- App Comercio (React Native)
- App Domiciliario (React Native)
- Selección real de ubicación en mapa para direcciones
- Notificaciones push (FCM)
- Calificaciones al comercio y al domiciliario
