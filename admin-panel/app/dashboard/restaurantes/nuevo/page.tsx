"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, Restaurant } from "@/lib/api";

const BUSINESS_TYPES: { value: Restaurant["business_type"]; label: string; emoji: string }[] = [
  { value: "restaurante", label: "Restaurante", emoji: "🍴" },
  { value: "supermercado", label: "Supermercado", emoji: "🛒" },
  { value: "farmacia", label: "Farmacia", emoji: "💊" },
  { value: "tienda", label: "Tienda", emoji: "🏬" },
  { value: "mascota", label: "Mascotas", emoji: "🐾" },
  { value: "belleza", label: "Belleza", emoji: "💅" },
];

export default function NuevoComercioPage() {
  const router = useRouter();
  const [businessType, setBusinessType] = useState<Restaurant["business_type"]>("restaurante");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [addressLine, setAddressLine] = useState("");
  // Coordenadas por defecto: centro de Bogotá. Ajusta manualmente según la
  // ubicación real del comercio (la app todavía no tiene geocodificación
  // automática de direcciones — es una limitación conocida, pendiente).
  const [latitude, setLatitude] = useState("4.6097");
  const [longitude, setLongitude] = useState("-74.0817");

  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError("La latitud y longitud deben ser números válidos.");
      return;
    }

    setLoading(true);
    try {
      await api.createRestaurant({
        owner_email: ownerEmail.trim(),
        owner_password: ownerPassword,
        owner_full_name: ownerFullName.trim(),
        owner_phone: ownerPhone.trim() || undefined,
        name: name.trim(),
        business_type: businessType,
        description: description.trim() || undefined,
        address_line: addressLine.trim(),
        latitude: lat,
        longitude: lng,
      });
      setSuccess(true);
      setTimeout(() => router.push("/dashboard/restaurantes"), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el comercio. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-xl">
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-6">
          <p className="font-semibold mb-1">¡Comercio creado con éxito!</p>
          <p className="text-sm">
            Ya quedó aprobado y con su cuenta de dueño lista. El dueño puede iniciar sesión en la app
            comercio con el correo y la contraseña que acabas de registrar. Redirigiendo…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Nuevo comercio</h1>
      <p className="text-sm text-slate-500 mb-6">
        Crea el negocio y la cuenta de su dueño en un solo paso. Queda aprobado automáticamente.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-medium text-slate-900 mb-4">Datos del negocio</h2>

          <label className="block text-sm text-slate-600 mb-1">Tipo de negocio</label>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {BUSINESS_TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => setBusinessType(t.value)}
                className={`px-3 py-2 rounded-lg text-sm border transition ${
                  businessType === t.value
                    ? "bg-brand text-white border-brand"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          <label className="block text-sm text-slate-600 mb-1">Nombre del negocio</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
            placeholder="Ej: Salsas El Gurmed"
          />

          <label className="block text-sm text-slate-600 mb-1">Descripción (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
            rows={2}
          />

          <label className="block text-sm text-slate-600 mb-1">Dirección</label>
          <input
            required
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
            placeholder="Ej: Cra 45 #12-30, Bello, Antioquia"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Latitud</label>
              <input
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Longitud</label>
              <input
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Todavía no hay geocodificación automática de direcciones — ajusta estas coordenadas
            manualmente según la ubicación real (puedes buscar la dirección en Google Maps y copiar
            las coordenadas desde ahí).
          </p>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-medium text-slate-900 mb-4">Cuenta del dueño</h2>

          <label className="block text-sm text-slate-600 mb-1">Nombre completo</label>
          <input
            required
            value={ownerFullName}
            onChange={(e) => setOwnerFullName(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
          />

          <label className="block text-sm text-slate-600 mb-1">Correo</label>
          <input
            required
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
          />

          <label className="block text-sm text-slate-600 mb-1">Contraseña (mínimo 8 caracteres)</label>
          <input
            required
            type="text"
            minLength={8}
            value={ownerPassword}
            onChange={(e) => setOwnerPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
            placeholder="El dueño podrá cambiarla después"
          />

          <label className="block text-sm text-slate-600 mb-1">Teléfono (opcional)</label>
          <input
            value={ownerPhone}
            onChange={(e) => setOwnerPhone(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? "Creando…" : "Crear comercio"}
        </button>
      </form>
    </div>
  );
}
