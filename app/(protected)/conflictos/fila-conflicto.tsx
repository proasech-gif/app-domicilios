"use client";

import { useState } from "react";
import { marcarResuelto } from "./actions";

const ICONO: Record<string, string> = { critico: "🔴", advertencia: "🟠", resuelto: "🟢" };

type Conflicto = {
  id: string;
  tipo: string;
  severidad: string;
  descripcion: string;
  resuelto: boolean;
  version_etiqueta: string;
};

export function FilaConflicto({ conflicto, puedeResolver }: { conflicto: Conflicto; puedeResolver: boolean }) {
  const [resuelto, setResuelto] = useState(conflicto.resuelto);
  const [cargando, setCargando] = useState(false);

  async function resolver() {
    setCargando(true);
    const r = await marcarResuelto(conflicto.id);
    setCargando(false);
    if (!r.error) setResuelto(true);
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-card border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <span>{resuelto ? ICONO.resuelto : ICONO[conflicto.severidad]}</span>
        <div>
          <p className="text-sm text-ink">{conflicto.descripcion}</p>
          <p className="text-xs text-muted">{conflicto.version_etiqueta}</p>
        </div>
      </div>
      {puedeResolver && !resuelto && (
        <button
          disabled={cargando}
          onClick={resolver}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 disabled:opacity-60"
        >
          {cargando ? "..." : "Resolver"}
        </button>
      )}
    </div>
  );
}
