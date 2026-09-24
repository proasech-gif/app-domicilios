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

const TOKEN_KEY = "cliente_access_token";
const REFRESH_KEY = "cliente_refresh_token";

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
    body: JSON.stringify({ ...input, role: "cliente" }),
  });
}

export const api = {
  me: () => request<User>("/api/users/me"),

  restaurants: (businessType?: BusinessType) =>
    request<Restaurant[]>(`/api/restaurants${businessType ? `?business_type=${businessType}` : ""}`),
  restaurant: (id: string) => request<Restaurant>(`/api/restaurants/${id}`),
  products: (restaurantId: string) => request<Product[]>(`/api/restaurants/${restaurantId}/products`),
  categories: (restaurantId: string) => request<Category[]>(`/api/restaurants/${restaurantId}/categories`),

  addresses: () => request<Address[]>("/api/addresses"),
  createAddress: (input: {
    label?: string;
    address_line: string;
    details?: string;
    latitude: number;
    longitude: number;
    is_default?: boolean;
  }) => request<Address>("/api/addresses", { method: "POST", body: JSON.stringify(input) }),

  createOrder: (input: {
    restaurant_id: string;
    delivery_address_id: string;
    payment_method: "efectivo" | "tarjeta" | "billetera_digital";
    items: { product_id: string; quantity: number; notes?: string }[];
    notes?: string;
    promo_code?: string;
    tip_amount?: number;
  }) => request<Order>("/api/orders", { method: "POST", body: JSON.stringify(input) }),

  deliveryFeePreview: (restaurantId: string, addressId: string) =>
    request<{ delivery_fee: number; distance_km: number }>(
      `/api/orders/delivery-fee-preview?restaurant_id=${restaurantId}&address_id=${addressId}`
    ),

  validatePromotion: (restaurantId: string, code: string) =>
    request<{
      valid: boolean;
      reason: string | null;
      code: string | null;
      discount_type: "percentage" | "fixed" | null;
      discount_value: number | null;
    }>(`/api/promotions/validate?code=${encodeURIComponent(code)}&restaurant_id=${restaurantId}`),

  myOrders: () => request<Order[]>("/api/orders/mine"),
  order: (id: string) => request<Order>(`/api/orders/${id}`),
  orderMessages: (id: string) => request<ChatMessage[]>(`/api/orders/${id}/messages`),

  // --- Pagos online (Wompi) ---
  createPaymentLink: (orderId: string) =>
    request<{ payment_url: string; reference: string }>(`/api/payments/orders/${orderId}/link`, {
      method: "POST",
    }),
  paymentStatus: (orderId: string) =>
    request<{ status: string }>(`/api/payments/orders/${orderId}/status`),

  createRating: (orderId: string, input: { target_type: "restaurant" | "delivery_person"; target_id: string; score: number; comment?: string }) =>
    request<Rating>(`/api/orders/${orderId}/ratings`, { method: "POST", body: JSON.stringify(input) }),
  orderRatings: (orderId: string) => request<Rating[]>(`/api/orders/${orderId}/ratings`),
};

export interface Rating {
  id: string;
  order_id: string;
  rater_id: string;
  target_type: "restaurant" | "delivery_person";
  target_id: string;
  score: number;
  comment: string | null;
  created_at: string;
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
  approval_status: string;
  is_open: boolean;
  average_rating: number | null;
  total_ratings: number;
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

export interface Address {
  id: string;
  label: string | null;
  address_line: string;
  details: string | null;
  is_default: boolean;
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
  status: string;
  payment_method: string;
  payment_status: string;
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

export async function registerPushToken(expoPushToken: string) {
  return request<void>("/api/users/me/push-token", {
    method: "PATCH",
    body: JSON.stringify({ expo_push_token: expoPushToken }),
  });
}
