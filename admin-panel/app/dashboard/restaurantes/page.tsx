"use client";

import { useEffect, useState } from "react";
import { api, Restaurant } from "@/lib/api";

export default function RestaurantesPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRestaurants(await api.pendingRestaurants());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handle(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      if (action === "approve") await api.approveRestaurant(id);
      else await api.rejectRestaurant(id);
      setRestaurants((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Comercios pendientes de aprobación</h1>
      <p className="text-sm text-slate-500 mb-6">Revisa y aprueba o rechaza los comercios que se han registrado.</p>

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}
      {!loading && restaurants.length === 0 && (
        <p className="text-sm text-slate-500">No hay comercios pendientes por ahora.</p>
      )}

      <div className="space-y-3">
        {restaurants.map((r) => (
          <div
            key={r.id}
            className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <p className="font-medium text-slate-900">{r.name}</p>
              <p className="text-sm text-slate-500">{r.address_line}</p>
              {r.description && <p className="text-sm text-slate-400 mt-1">{r.description}</p>}
            </div>
            <div className="flex gap-2">
              <button
                disabled={busyId === r.id}
                onClick={() => handle(r.id, "approve")}
                className="px-3 py-1.5 rounded-lg text-sm bg-brand text-white hover:bg-brand-dark disabled:opacity-60"
              >
                Aprobar
              </button>
              <button
                disabled={busyId === r.id}
                onClick={() => handle(r.id, "reject")}
                className="px-3 py-1.5 rounded-lg text-sm bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60"
              >
                Rechazar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
