"use client";

import { useEffect, useState } from "react";
import { api, Order } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  creado: "Creado",
  confirmado_comercio: "Confirmado por comercio",
  en_preparacion: "En preparación",
  listo_para_recoger: "Listo para recoger",
  domiciliario_asignado: "Domiciliario asignado",
  en_camino_a_comercio: "Domiciliario en camino al comercio",
  recogido: "Recogido",
  en_camino_a_cliente: "En camino al cliente",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  creado: "bg-slate-100 text-slate-700",
  confirmado_comercio: "bg-blue-100 text-blue-700",
  en_preparacion: "bg-blue-100 text-blue-700",
  listo_para_recoger: "bg-amber-100 text-amber-700",
  domiciliario_asignado: "bg-amber-100 text-amber-700",
  en_camino_a_comercio: "bg-amber-100 text-amber-700",
  recogido: "bg-amber-100 text-amber-700",
  en_camino_a_cliente: "bg-amber-100 text-amber-700",
  entregado: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
};

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setOrders(await api.allOrders(filter || undefined));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Refresco automático cada 15s para simular "tiempo real" sin depender del WebSocket en el panel
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Pedidos</h1>
          <p className="text-sm text-slate-500">Vista global de todos los pedidos de la plataforma.</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-slate-300 text-sm px-3 py-2"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Pedido</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Domiciliario</th>
              <th className="px-4 py-3 font-medium">Creado</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{o.id.slice(0, 8)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${STATUS_COLORS[o.status] || ""}`}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </td>
                <td className="px-4 py-3">${o.total.toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-500">
                  {o.delivery_person_id ? o.delivery_person_id.slice(0, 8) : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">{new Date(o.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && orders.length === 0 && (
          <p className="text-sm text-slate-500 px-4 py-6 text-center">No hay pedidos con ese filtro.</p>
        )}
      </div>
    </div>
  );
}
