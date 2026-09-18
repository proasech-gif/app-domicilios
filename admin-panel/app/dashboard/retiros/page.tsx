"use client";

import { useEffect, useState } from "react";
import { api, WithdrawalAdmin } from "@/lib/api";

function formatCOP(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("es-CO")}`;
}

export default function RetirosPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setWithdrawals(await api.pendingWithdrawals());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handle(id: string, action: "complete" | "reject") {
    if (action === "complete") {
      const confirmed = window.confirm(
        "¿Ya hiciste la transferencia bancaria REAL a esta persona? Esto descontará el saldo de su billetera."
      );
      if (!confirmed) return;
    }
    setBusyId(id);
    try {
      if (action === "complete") await api.completeWithdrawal(id);
      else await api.rejectWithdrawal(id);
      setWithdrawals((prev) => prev.filter((w) => w.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Retiros pendientes</h1>
      <p className="text-slate-500 mb-6">
        Solicitudes de comercios y domiciliarios para retirar su saldo a su cuenta bancaria real.
      </p>

      {withdrawals.length === 0 && <p className="text-slate-500">No hay retiros pendientes por ahora.</p>}

      <div className="space-y-3">
        {withdrawals.map((w) => (
          <div key={w.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-slate-900">{w.user_full_name}</p>
                <p className="text-sm text-slate-500">{w.user_email}</p>
                <p className="text-2xl font-bold text-brand mt-2">{formatCOP(w.amount_cents)}</p>
                <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{w.bank_info}</p>
                <p className="text-xs text-slate-400 mt-2">
                  Solicitado: {new Date(w.requested_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  disabled={busyId === w.id}
                  onClick={() => handle(w.id, "complete")}
                  className="px-3 py-1.5 rounded-lg text-sm bg-brand text-white hover:bg-brand-dark disabled:opacity-60"
                >
                  Marcar pagado
                </button>
                <button
                  disabled={busyId === w.id}
                  onClick={() => handle(w.id, "reject")}
                  className="px-3 py-1.5 rounded-lg text-sm bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60"
                >
                  Rechazar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
