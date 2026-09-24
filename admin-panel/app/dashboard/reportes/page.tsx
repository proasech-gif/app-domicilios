"use client";

import { useEffect, useState } from "react";
import { api, ApiError, Report } from "@/lib/api";

const REASON_LABELS: Record<string, string> = {
  producto_incorrecto: "Producto incorrecto",
  producto_danado: "Producto dañado",
  domiciliario_no_llego: "Domiciliario no llegó",
  comportamiento_inapropiado: "Comportamiento inapropiado",
  cobro_incorrecto: "Cobro incorrecto",
  otro: "Otro",
};

const STATUS_LABELS: Record<Report["status"], string> = {
  abierto: "Abierto",
  en_revision: "En revisión",
  resuelto: "Resuelto",
  descartado: "Descartado",
};

const STATUS_COLORS: Record<Report["status"], string> = {
  abierto: "bg-red-50 text-red-700",
  en_revision: "bg-amber-50 text-amber-700",
  resuelto: "bg-emerald-50 text-emerald-700",
  descartado: "bg-slate-100 text-slate-500",
};

export default function ReportesPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState<string>("otro");
  const [orderId, setOrderId] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setReports(await api.listReports());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleStatusChange(id: string, status: Report["status"]) {
    setBusyId(id);
    try {
      const updated = await api.updateReportStatus(id, status);
      setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateReport(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      const created = await api.createReport({
        order_id: orderId.trim() || undefined,
        reason,
        description: description.trim() || undefined,
      });
      setReports((prev) => [created, ...prev]);
      setShowForm(false);
      setReason("otro");
      setOrderId("");
      setDescription("");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo crear el reporte.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-slate-900">Reportes</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark"
        >
          {showForm ? "Cancelar" : "+ Nuevo reporte"}
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Problemas reportados por clientes, comercios y domiciliarios. Útil también para registrar
        aquí mismo un reclamo que te llegue por teléfono o WhatsApp.
      </p>

      {showForm && (
        <form onSubmit={handleCreateReport} className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <label className="block text-sm text-slate-600 mb-1">Motivo</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
          >
            {Object.entries(REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label className="block text-sm text-slate-600 mb-1">ID del pedido (opcional)</label>
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="Pégalo desde la pantalla de Pedidos, si aplica"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
          />

          <label className="block text-sm text-slate-600 mb-1">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
            placeholder="Detalles de lo que te contaron..."
          />

          {formError && <p className="text-sm text-red-600 mb-3">{formError}</p>}

          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark disabled:opacity-60"
          >
            {creating ? "Creando…" : "Crear reporte"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-slate-400">No hay reportes todavía.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">{REASON_LABELS[r.reason] || r.reason}</p>
                  {r.description && <p className="text-sm text-slate-600 mt-1">{r.description}</p>}
                  <p className="text-xs text-slate-400 mt-2">
                    {new Date(r.created_at).toLocaleString("es-CO")}
                    {r.order_id && <> · Pedido {r.order_id.slice(0, 8)}</>}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${STATUS_COLORS[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
              </div>

              <div className="flex gap-2 mt-3">
                {(["abierto", "en_revision", "resuelto", "descartado"] as const)
                  .filter((s) => s !== r.status)
                  .map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(r.id, s)}
                      disabled={busyId === r.id}
                      className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Marcar como {STATUS_LABELS[s].toLowerCase()}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
