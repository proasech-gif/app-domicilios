"use client";

import { useEffect, useState } from "react";
import { api, ApiError, Promotion } from "@/lib/api";

const BUSINESS_TYPES: { value: string; label: string }[] = [
  { value: "restaurante", label: "Restaurantes" },
  { value: "supermercado", label: "Supermercados" },
  { value: "farmacia", label: "Farmacias" },
  { value: "tienda", label: "Tiendas" },
  { value: "mascota", label: "Mascotas" },
  { value: "belleza", label: "Belleza" },
];

export default function PromocionesPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [targetAudience, setTargetAudience] = useState<"cliente" | "comercio" | "domiciliario">("cliente");
  const [targetBusinessType, setTargetBusinessType] = useState<string>("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setPromotions(await api.listPromotions());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggle(promo: Promotion) {
    setBusyId(promo.id);
    try {
      const updated = promo.is_active ? await api.disapprovePromotion(promo.id) : await api.approvePromotion(promo.id);
      setPromotions((prev) => prev.map((p) => (p.id === promo.id ? updated : p)));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      const created = await api.createPromotion({
        code,
        description: description.trim() || undefined,
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        target_audience: targetAudience,
        target_business_type: targetAudience === "cliente" && targetBusinessType ? targetBusinessType : undefined,
        starts_at: startsAt ? new Date(startsAt).toISOString() : undefined,
        ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
      });
      setPromotions((prev) => [created, ...prev]);
      setShowForm(false);
      setCode("");
      setDescription("");
      setDiscountValue("");
      setTargetAudience("cliente");
      setTargetBusinessType("");
      setStartsAt("");
      setEndsAt("");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo crear el cupón.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-slate-900">Cupones</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark"
        >
          {showForm ? "Cancelar" : "+ Cupón de plataforma"}
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Aquí ves todos los cupones: los que crean los comercios (quedan aprobados automáticamente,
        pero los puedes desaprobar) y los que tú creas para toda la plataforma.
      </p>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <label className="block text-sm text-slate-600 mb-1">Código del cupón</label>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ej: BIENVENIDA20"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
          />

          <label className="block text-sm text-slate-600 mb-1">Descripción</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
          />

          <label className="block text-sm text-slate-600 mb-1">¿Para quién es este cupón?</label>
          <select
            value={targetAudience}
            onChange={(e) => {
              const value = e.target.value as "cliente" | "comercio" | "domiciliario";
              setTargetAudience(value);
              if (value !== "cliente") setDiscountType("fixed");
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
          >
            <option value="cliente">Clientes (descuento en su pedido)</option>
            <option value="comercio">Comercios (bono en su billetera)</option>
            <option value="domiciliario">Domiciliarios (bono en su billetera)</option>
          </select>

          {targetAudience === "cliente" && (
            <>
              <label className="block text-sm text-slate-600 mb-1">Tipo de negocio (opcional)</label>
              <select
                value={targetBusinessType}
                onChange={(e) => setTargetBusinessType(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
              >
                <option value="">Todos los tipos de negocio</option>
                {BUSINESS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Tipo de descuento</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed")}
                disabled={targetAudience !== "cliente"}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-100"
              >
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed">Monto fijo ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Valor</label>
              <input
                required
                type="number"
                min="1"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percentage" ? "Ej: 20" : "Ej: 5000"}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Fecha de inicio (opcional)</label>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Fecha de fin {targetAudience !== "cliente" ? "" : "(opcional)"}
              </label>
              <input
                required={targetAudience !== "cliente"}
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          {targetAudience !== "cliente" && (
            <p className="text-xs text-slate-400 -mt-3 mb-4">
              Los bonos necesitan una fecha de fin, para que no queden activos para siempre.
            </p>
          )}

          {formError && <p className="text-sm text-red-600 mb-3">{formError}</p>}

          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark disabled:opacity-60"
          >
            {creating ? "Creando…" : "Crear cupón"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : promotions.length === 0 ? (
        <p className="text-sm text-slate-400">No hay cupones todavía.</p>
      ) : (
        <div className="space-y-3">
          {promotions.map((p) => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {p.code} · {p.discount_type === "percentage" ? `${p.discount_value}%` : `$${p.discount_value.toLocaleString()}`}
                  </p>
                  {p.description && <p className="text-sm text-slate-600 mt-1">{p.description}</p>}
                  <p className="text-xs text-slate-400 mt-2">
                    {p.restaurant_id
                      ? "Cupón de un comercio"
                      : `Cupón de plataforma · ${
                          p.target_audience === "domiciliario"
                            ? "bono para domiciliarios"
                            : p.target_audience === "comercio"
                              ? "bono para comercios"
                              : `para ${p.target_business_type ? BUSINESS_TYPES.find((t) => t.value === p.target_business_type)?.label : "todos los negocios"}`
                        }`}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
                    p.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {p.is_active ? "Aprobado" : "Desaprobado"}
                </span>
              </div>
              <button
                onClick={() => handleToggle(p)}
                disabled={busyId === p.id}
                className="mt-3 text-xs px-2.5 py-1 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {p.is_active ? "Desaprobar" : "Aprobar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
