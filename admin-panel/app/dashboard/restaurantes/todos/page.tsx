"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Restaurant } from "@/lib/api";

const STATUS_LABELS: Record<Restaurant["approval_status"], string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  suspended: "Suspendido",
};

const TYPE_EMOJI: Record<Restaurant["business_type"], string> = {
  restaurante: "🍴",
  supermercado: "🛒",
  farmacia: "💊",
  tienda: "🏬",
  mascota: "🐾",
  belleza: "💅",
};

export default function TodosLosComerciosPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .allRestaurants()
      .then(setRestaurants)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-slate-900">Todos los comercios</h1>
        <Link
          href="/dashboard/restaurantes/nuevo"
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark"
        >
          + Nuevo comercio
        </Link>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Edita cualquier comercio, incluyendo su logo y foto de portada.
      </p>

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : restaurants.length === 0 ? (
        <p className="text-sm text-slate-400">Todavía no hay comercios registrados.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {restaurants.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/restaurantes/${r.id}/editar`}
              className="block bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition"
            >
              <div className="h-24 bg-slate-100 flex items-center justify-center">
                {r.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.logo_url} alt={r.name} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <span className="text-3xl">{TYPE_EMOJI[r.business_type]}</span>
                )}
              </div>
              <div className="p-4">
                <p className="font-medium text-slate-900 truncate">{r.name}</p>
                <p className="text-xs text-slate-500 truncate">{r.address_line}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-400">
                    {TYPE_EMOJI[r.business_type]} {r.business_type}
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      r.approval_status === "approved"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {STATUS_LABELS[r.approval_status]}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
