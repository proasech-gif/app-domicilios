import AsyncStorage from "@react-native-async-storage/async-storage";

// IMPORTANTE: como la app corre en tu celular (no en la misma computadora que el backend),
// "localhost" NO funciona aquí. Usa la IP de red local de tu computador.
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.185:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = "comercio_access_token";
const REFRESH_KEY = "comercio_refresh_token";

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
    // Solo si YA había un token (sesión existente) lo borramos; si es un intento
    // de login, no había token que borrar y el mensaje debe ser el del backend
    // (ej. "Correo o contraseña incorrectos"), no "sesión expirada".
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
    body: JSON.stringify({ ...input, role: "comercio" }),
  });
}

export const api = {
  me: () => request<User>("/api/users/me"),

  // --- Restaurante propio ---
  myRestaurants: () => request<Restaurant[]>("/api/restaurants/mine"),
  createRestaurant: (input: {
    name: string;
    business_type: BusinessType;
    description?: string;
    address_line: string;
    latitude: number;
    longitude: number;
    opens_at?: string;
    closes_at?: string;
  }) => request<Restaurant>("/api/restaurants", { method: "POST", body: JSON.stringify(input) }),
  updateRestaurant: (
    id: string,
    input: Partial<{
      name: string;
      description: string;
      logo_url: string;
      cover_photo_url: string;
      opens_at: string;
      closes_at: string;
    }>
  ) => request<Restaurant>(`/api/restaurants/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  toggleOpen: (id: string) =>
    request<Restaurant>(`/api/restaurants/${id}/toggle-open`, { method: "PATCH" }),
  uploadImageBase64: (filename: string, contentType: string, dataBase64: string) =>
    request<{ url: string }>("/api/uploads/image-base64", {
      method: "POST",
      body: JSON.stringify({ filename, content_type: contentType, data_base64: dataBase64 }),
    }),

  // --- Categorías ---
  categories: (restaurantId: string) => request<Category[]>(`/api/restaurants/${restaurantId}/categories`),
  createCategory: (restaurantId: string, input: { name: string; display_order?: number }) =>
    request<Category>(`/api/restaurants/${restaurantId}/categories`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // --- Productos ---
  products: (restaurantId: string) => request<Product[]>(`/api/restaurants/${restaurantId}/products`),
  createProduct: (
    restaurantId: string,
    input: { name: string; description?: string; price: number; category_id?: string; photo_url?: string }
  ) =>
    request<Product>(`/api/restaurants/${restaurantId}/products`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateProduct: (
    productId: string,
    input: Partial<{
      name: string;
      description: string;
      price: number;
      category_id: string;
      photo_url: string;
      is_available: boolean;
    }>
  ) => request<Product>(`/api/restaurants/products/${productId}`, { method: "PATCH", body: JSON.stringify(input) }),

  // --- Pedidos ---
  restaurantOrders: (restaurantId: string) => request<Order[]>(`/api/orders/restaurant/${restaurantId}`),
  order: (id: string) => request<Order>(`/api/orders/${id}`),
  updateOrderStatus: (id: string, status: OrderStatus) =>
    request<Order>(`/api/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  orderMessages: (id: string) => request<ChatMessage[]>(`/api/orders/${id}/messages`),

  // --- Billetera ---
  wallet: () => request<Wallet>("/api/wallet/me"),
  requestWithdrawal: (input: { amount_cents: number; bank_info: string }) =>
    request<Withdrawal>("/api/wallet/withdrawals", { method: "POST", body: JSON.stringify(input) }),
  myWithdrawals: () => request<Withdrawal[]>("/api/wallet/withdrawals/mine"),

  // --- Cupones ---
  myPromotions: (restaurantId: string) => request<Promotion[]>(`/api/restaurants/${restaurantId}/promotions`),
  createPromotion: (restaurantId: string, data: NewPromotionData) =>
    request<Promotion>(`/api/restaurants/${restaurantId}/promotions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  togglePromotion: (id: string) =>
    request<Promotion>(`/api/promotions/${id}/toggle`, { method: "PATCH" }),
  redeemBonus: (code: string) =>
    request<{ valid: boolean; reason: string | null; amount_credited_cents: number | null }>(
      `/api/promotions/redeem-bonus?code=${encodeURIComponent(code)}`,
      { method: "POST" }
    ),
};

export interface Promotion {
  id: string;
  restaurant_id: string | null;
  code: string | null;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

export interface NewPromotionData {
  code: string;
  description?: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  starts_at?: string;
  ends_at?: string;
}

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

export type BusinessType = "restaurante" | "supermercado" | "farmacia" | "tienda" | "mascota" | "belleza";

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  business_type: BusinessType;
  description: string | null;
  logo_url: string | null;
  cover_photo_url: string | null;
  address_line: string;
  approval_status: "pending" | "approved" | "rejected" | "suspended";
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  display_order: number;
}

export interface Product {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  photo_url: string | null;
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
