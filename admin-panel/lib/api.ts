const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_access_token");
}

export function setToken(token: string) {
  localStorage.setItem("admin_access_token", token);
}

export function clearToken() {
  localStorage.removeItem("admin_access_token");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError("Sesión expirada", 401);
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
  setToken(data.access_token);
  return data;
}

export const api = {
  me: () => request<{ id: string; email: string; full_name: string; role: string }>("/api/users/me"),

  stats: () =>
    request<{
      total_orders: number;
      active_orders: number;
      delivered_orders: number;
      cancelled_orders: number;
      total_revenue: number;
    }>("/api/admin/stats"),

  pendingRestaurants: () => request<Restaurant[]>("/api/admin/restaurants/pending"),
  approveRestaurant: (id: string) =>
    request<Restaurant>(`/api/admin/restaurants/${id}/approve`, { method: "PATCH" }),
  rejectRestaurant: (id: string) =>
    request<Restaurant>(`/api/admin/restaurants/${id}/reject`, { method: "PATCH" }),
  suspendRestaurant: (id: string) =>
    request<Restaurant>(`/api/admin/restaurants/${id}/suspend`, { method: "PATCH" }),

  pendingDeliveryPersons: () => request<DeliveryPerson[]>("/api/admin/delivery-persons/pending"),
  approveDeliveryPerson: (id: string) =>
    request<DeliveryPerson>(`/api/admin/delivery-persons/${id}/approve`, { method: "PATCH" }),
  rejectDeliveryPerson: (id: string) =>
    request<DeliveryPerson>(`/api/admin/delivery-persons/${id}/reject`, { method: "PATCH" }),

  allOrders: (statusFilter?: string) =>
    request<Order[]>(`/api/admin/orders${statusFilter ? `?status_filter=${statusFilter}` : ""}`),

  listUsers: (roleFilter?: string) =>
    request<AdminUser[]>(`/api/admin/users${roleFilter ? `?role_filter=${roleFilter}` : ""}`),

  suspendUser: (id: string) => request(`/api/admin/users/${id}/suspend`, { method: "PATCH" }),
  reactivateUser: (id: string) => request(`/api/admin/users/${id}/reactivate`, { method: "PATCH" }),

  pendingWithdrawals: () => request<WithdrawalAdmin[]>("/api/admin/withdrawals/pending"),
  completeWithdrawal: (id: string) =>
    request<WithdrawalAdmin>(`/api/admin/withdrawals/${id}/complete`, { method: "PATCH" }),
  rejectWithdrawal: (id: string) =>
    request<WithdrawalAdmin>(`/api/admin/withdrawals/${id}/reject`, { method: "PATCH" }),
};

// --- Tipos ---

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  address_line: string;
  approval_status: "pending" | "approved" | "rejected" | "suspended";
  is_open: boolean;
}

export interface DeliveryPerson {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_plate: string | null;
  id_document_url: string | null;
  vehicle_document_url: string | null;
  selfie_url: string | null;
  approval_status: "pending" | "approved" | "rejected" | "suspended";
  is_available: boolean;
}

export interface Order {
  id: string;
  customer_id: string;
  restaurant_id: string;
  delivery_person_id: string | null;
  status: string;
  total: number;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: "cliente" | "comercio" | "domiciliario" | "admin";
  is_active: boolean;
}

export interface WithdrawalAdmin {
  id: string;
  wallet_id: string;
  user_email: string;
  user_full_name: string;
  amount_cents: number;
  bank_info: string;
  status: "pendiente" | "completado" | "rechazado";
  requested_at: string;
}
