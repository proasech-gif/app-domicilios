import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.185:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = "domiciliario_access_token";
const REFRESH_KEY = "domiciliario_refresh_token";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setTokens(access: string, refresh: string) {
  await AsyncStorage.setItem(TOKEN_KEY, access);
  await AsyncStorage.setItem(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    let detail = "Sesión expirada, inicia sesión de nuevo";
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch {
      /* ignore */
    }
    if (token) {
      await clearTokens();
      throw new ApiError("Sesión expirada, inicia sesión de nuevo", 401);
    }
    throw new ApiError(detail, 401);
  }

  if (!res.ok) {
    let detail = "Error en la solicitud";
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const data = await request<{ access_token: string; refresh_token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function register(input: {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}) {
  return request<User>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ ...input, role: "domiciliario" }),
  });
}

/**
 * Sube una foto (URI local del celular, ej. de expo-image-picker) al backend
 * y devuelve la URL pública ya alojada en el almacenamiento del servidor.
 */
export async function uploadImage(localUri: string): Promise<string> {
  const filename = localUri.split("/").pop() || `foto_${Date.now()}.jpg`;
  const match = /\.(\w+)$/.exec(filename);
  const ext = (match?.[1] || "jpg").toLowerCase();
  const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  // Leemos el archivo como texto base64 y lo mandamos dentro de un JSON normal.
  // Esto evita por completo los problemas de compatibilidad de FormData/multipart
  // que existen en algunas combinaciones de React Native + Android.
  const base64Data = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return request<{ url: string }>("/api/uploads/image-base64", {
    method: "POST",
    body: JSON.stringify({ filename, content_type: contentType, data_base64: base64Data }),
  }).then((data) => data.url);
}

export const api = {
  me: () => request<User>("/api/users/me"),

  // --- Perfil de domiciliario ---
  myProfile: () => request<DeliveryPerson>("/api/delivery/profile/me"),
  createProfile: (input: {
    vehicle_type: VehicleType;
    vehicle_plate?: string;
    id_document_url: string;
    vehicle_document_url?: string;
    selfie_url: string;
    license_document_url?: string;
  }) => request<DeliveryPerson>("/api/delivery/profile", { method: "POST", body: JSON.stringify(input) }),
  toggleAvailability: () => request<DeliveryPerson>("/api/delivery/availability", { method: "PATCH" }),
  updateLocation: (latitude: number, longitude: number) =>
    request<DeliveryPerson>("/api/delivery/location", {
      method: "PATCH",
      body: JSON.stringify({ latitude, longitude }),
    }),

  // --- Pedidos ---
  availableForPickup: () => request<Order[]>("/api/orders/available-for-pickup"),
  myDeliveries: () => request<Order[]>("/api/orders/my-deliveries"),
  order: (id: string) => request<Order>(`/api/orders/${id}`),
  assignDelivery: (orderId: string) => request<Order>(`/api/orders/${orderId}/assign-delivery`, { method: "POST" }),
  updateOrderStatus: (id: string, status: OrderStatus) =>
    request<Order>(`/api/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  orderMessages: (id: string) => request<ChatMessage[]>(`/api/orders/${id}/messages`),

  // --- Billetera ---
  wallet: () => request<Wallet>("/api/wallet/me"),
  requestWithdrawal: (input: { amount_cents: number; bank_info: string }) =>
    request<Withdrawal>("/api/wallet/withdrawals", { method: "POST", body: JSON.stringify(input) }),
  myWithdrawals: () => request<Withdrawal[]>("/api/wallet/withdrawals/mine"),

  // --- Bonos ---
  redeemBonus: (code: string) =>
    request<{ valid: boolean; reason: string | null; amount_credited_cents: number | null }>(
      `/api/promotions/redeem-bonus?code=${encodeURIComponent(code)}`,
      { method: "POST" }
    ),
};

export function wsUrl(path: string, token: string): string {
  const base = API_URL.replace(/^http/, "ws");
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

// --- Tipos ---

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
}

export type VehicleType = "moto" | "bicicleta" | "carro" | "a_pie";

export type OrderStatus =
  | "creado"
  | "confirmado_comercio"
  | "en_preparacion"
  | "listo_para_recoger"
  | "domiciliario_asignado"
  | "en_camino_a_comercio"
  | "recogido"
  | "en_camino_a_cliente"
  | "entregado"
  | "cancelado";

export interface DeliveryPerson {
  id: string;
  user_id: string;
  vehicle_type: VehicleType;
  vehicle_plate: string | null;
  id_document_url: string | null;
  vehicle_document_url: string | null;
  selfie_url: string | null;
  approval_status: "pending" | "approved" | "rejected" | "suspended";
  is_available: boolean;
}

export interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
}

export interface Order {
  id: string;
  customer_id: string;
  restaurant_id: string;
  delivery_person_id: string | null;
  delivery_address_id: string;
  status: OrderStatus;
  payment_method: string;
  subtotal: number;
  delivery_fee: number;
  commission_amount: number;
  total: number;
  notes: string | null;
  created_at: string;
  items: OrderItem[];
}

export interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  message: string;
  sent_at: string;
}

export interface WalletTransaction {
  id: string;
  order_id: string | null;
  type: "credito" | "debito";
  amount_cents: number;
  description: string | null;
  created_at: string;
}

export interface Wallet {
  balance_cents: number;
  transactions: WalletTransaction[];
}

export interface Withdrawal {
  id: string;
  amount_cents: number;
  bank_info: string;
  status: "pendiente" | "completado" | "rechazado";
  requested_at: string;
  processed_at: string | null;
}

export async function registerPushToken(expoPushToken: string) {
  return request<void>("/api/users/me/push-token", {
    method: "PATCH",
    body: JSON.stringify({ expo_push_token: expoPushToken }),
  });
}
