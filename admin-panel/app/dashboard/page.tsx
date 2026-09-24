"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import StatCard from "@/components/StatCard";

interface Stats {
  total_orders: number;
  active_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  total_revenue: number;
  total_commission: number;
  pending_cash_debt_cents: number;
}

export default function DashboardHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch(() => setError("No se pudieron cargar las estadísticas"));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Resumen general</h1>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Pedidos totales" value={stats.total_orders} />
          <StatCard label="Pedidos activos" value={stats.active_orders} />
          <StatCard label="Entregados" value={stats.delivered_orders} />
          <StatCard label="Cancelados" value={stats.cancelled_orders} />
          <StatCard label="Ingresos (entregados)" value={`$${stats.total_revenue.toLocaleString()}`} />
          <StatCard label="Comisión ganada (app)" value={`$${stats.total_commission.toLocaleString()}`} />
          <StatCard
            label="Efectivo pendiente de domiciliarios"
            value={`$${(stats.pending_cash_debt_cents / 100).toLocaleString()}`}
          />
        </div>
      ) : (
        !error && <p className="text-sm text-slate-500">Cargando…</p>
      )}
    </div>
  );
}
