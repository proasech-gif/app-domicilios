"use client";

import { useState } from "react";
import { aprobarEmergencia, devolverEmergencia } from "./actions";

const ETIQUETA_ESTADO: Record<string, { texto: string; color: string }> = {
  borrador: { texto: "Borrador", color: "bg-border text-muted" },
  pendiente_aprobacion: { texto: "Pendiente de aprobación", color: "bg-accent-amber/15 text-accent-amber" },
  aprobado: { texto: "Aprobado", color: "bg-accent-teal/15 text-accent-teal" },
  devuelto: { texto: "Devuelto", color: "bg-accent-coral/15 text-accent-coral" },
};

type Alternativa = {
  id: string;
  motivo: string;
  fecha_inicio: string;
  duracion_dias: number;
  estado: string;
  puntuacion: number | null;
};

export function FilaAlternativa({ alternativa, esRector }: { alternativa: Alternativa; esRector: boolean }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarDevolucion, setMostrarDevolucion] = useState(false);
  const [comentario, setComentario] = useState("");

  const estado = ETIQUETA_ESTADO[alternativa.estado] ?? { texto: alternativa.estado, color: "bg-border" };

  async function aprobar() {
    setCargando(true);
    setError(null);
    const r = await aprobarEmergencia(alternativa.id, "");
    setCargando(false);
    if (r.error) setError(r.error);
  }

  async function devolver() {
    setCargando(true);
    setError(null);
    const r = await devolverEmergencia(alternativa.id, comentario);
    setCargando(false);
    if (r.error) setError(r.error);
    else setMostrarDevolucion(false);
  }

  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">🔄 {alternativa.motivo}</p>
          <p className="text-xs text-muted">
            Desde {alternativa.fecha_inicio} · {alternativa.duracion_dias} día(s)
            {alternativa.puntuacion != null && ` · Puntuación ${alternativa.puntuacion}/100`}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${estado.color}`}>
          {estado.texto}
        </span>
      </div>

      {esRector && alternativa.estado === "pendiente_aprobacion" && !mostrarDevolucion && (
        <div className="mt-3 flex gap-2">
          <button
            disabled={cargando}
            onClick={aprobar}
            className="rounded-md bg-accent-teal px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            Aprobar
          </button>
          <button
            disabled={cargando}
            onClick={() => setMostrarDevolucion(true)}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-accent-coral hover:bg-accent-coral/5"
          >
            Devolver
          </button>
        </div>
      )}

      {mostrarDevolucion && (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Explica qué se debe ajustar..."
            className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              disabled={cargando}
              onClick={devolver}
              className="rounded-md bg-accent-coral px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              Confirmar devolución
            </button>
            <button
              onClick={() => setMostrarDevolucion(false)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-accent-coral">{error}</p>}
    </div>
  );
}
