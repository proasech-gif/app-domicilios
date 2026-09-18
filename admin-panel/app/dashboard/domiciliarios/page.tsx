"use client";

import { useEffect, useState } from "react";
import { api, DeliveryPerson } from "@/lib/api";

export default function DomiciliariosPage() {
  const [people, setPeople] = useState<DeliveryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setPeople(await api.pendingDeliveryPersons());
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
      if (action === "approve") await api.approveDeliveryPerson(id);
      else await api.rejectDeliveryPerson(id);
      setPeople((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Domiciliarios pendientes de aprobación</h1>
      <p className="text-sm text-slate-500 mb-6">Revisa el vehículo y los documentos antes de aprobar.</p>

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}
      {!loading && people.length === 0 && (
        <p className="text-sm text-slate-500">No hay domiciliarios pendientes por ahora.</p>
      )}

      <div className="space-y-3">
        {people.map((p) => (
          <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-slate-900 capitalize">{p.vehicle_type.replace("_", " ")}</p>
                <p className="text-sm text-slate-500">Placa: {p.vehicle_plate || "N/A"}</p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busyId === p.id}
                  onClick={() => handle(p.id, "approve")}
                  className="px-3 py-1.5 rounded-lg text-sm bg-brand text-white hover:bg-brand-dark disabled:opacity-60"
                >
                  Aprobar
                </button>
                <button
                  disabled={busyId === p.id}
                  onClick={() => handle(p.id, "reject")}
                  className="px-3 py-1.5 rounded-lg text-sm bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60"
                >
                  Rechazar
                </button>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <PhotoThumb label="Documento de identidad" url={p.id_document_url} />
              <PhotoThumb label="Documento del vehículo" url={p.vehicle_document_url} />
              <PhotoThumb label="Selfie" url={p.selfie_url} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotoThumb({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="text-center">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            className="w-28 h-28 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition"
          />
        </a>
      ) : (
        <div className="w-28 h-28 flex items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
          Sin foto
        </div>
      )}
      <p className="text-xs text-slate-500 mt-1 w-28">{label}</p>
    </div>
  );
}
