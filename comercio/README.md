# App Comercio — Plataforma de Domicilios

App React Native (Expo) para que los restaurantes/comercios gestionen su menú y reciban pedidos.

## Instalación

```bash
cd comercio
npm install
```

## Configuración

Edita `.env` y pon la IP local de tu computador (la misma que usaste en `cliente/.env`):

```
EXPO_PUBLIC_API_URL=http://TU_IP_LOCAL:8000
```

## Ejecutar

```bash
npx expo start
```

Escanea el QR con Expo Go en el celular (misma red WiFi que el backend).

## Flujo de uso

1. **Regístrate** como comercio (esto crea tu usuario).
2. Automáticamente se te pedirá **crear tu comercio** (nombre, dirección, descripción). Queda en estado "pendiente".
3. Un **administrador** debe aprobar el comercio desde el panel admin antes de que puedas recibir pedidos.
4. Una vez aprobado:
   - En la pestaña **Menú**, agrega productos y actívalos/desactívalos.
   - En **Mi comercio**, abre o cierra tu negocio (switch).
   - En **Pedidos**, verás los pedidos entrantes en tiempo real (se actualiza cada 6s) y podrás:
     - Confirmar pedido → Empezar preparación → Marcar listo para recoger
     - Rechazar un pedido nuevo
   - Toca un pedido para ver el detalle y chatear con el cliente.

## Notas

- Requiere que el backend esté corriendo y accesible desde el celular (misma red WiFi, IP correcta en `.env`).
- La ubicación del comercio usa coordenadas de referencia fijas por ahora; la selección real en mapa se añadirá en la fase de geolocalización avanzada.
