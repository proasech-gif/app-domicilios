"use client";

import { useState } from "react";
import { aprobarVersion, devolverVersion, enviarAAprobacion, publicarVersion } from "./actions";

const ETIQUETA_ESTADO: Record<string, { texto: string; color: string }> = {
  borrador: { texto: "Borrador", color: "bg-border text-muted" },
  pendiente_aprobacion: { texto: "Pendiente de aprobación", color: "bg-accent-amber/15 text-accent-amber" },
  aprobado: { texto: "Aprobado", color: "bg-accent-teal/15 text-accent-teal" },
  devuelto: { texto: "Devuelto", color: "bg-accent-coral/15 text-accent-coral" },
  publicado: { texto: "Publicado", color: "bg-brand-600 text-white" },
};

type Version = {
  id: string;
  numero_version: number;
  estado: string;
  puntuacion: number | null;
  conflictos_criticos: number;
  creador_nombre: string;
};

export function FilaVersion({
  version,
  esCoordinador,
  esRector,
}: {
  version: Version;
  esCoordinador: boolean;
  esRector: boolean;
}) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarDevolucion, setMostrarDevolucion] = useState(false);
  const [comentario, setComentario] = useState("");

  async function accion(fn: () => Promise<{ error: string | null }>) {
    setCargando(true);
    setError(null);
    const resultado = await fn();
    setCargando(false);
    if (resultado.error) setError(resultado.error);
  }

  const estado = ETIQUETA_ESTADO[version.estado] ?? { texto: version.estado, color: "bg-border" };

  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">
            Horario — Versión {version.numero_version}
          </p>
          <p className="text-xs text-muted">
            Creado por {version.creador_nombre}
            {version.puntuacion != null && ` · Puntuación ${version.puntuacion}/100`}
            {version.conflictos_criticos > 0 && (
              <span className="text-accent-coral"> · {version.conflictos_criticos} conflicto(s) crítico(s)</span>
            )}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${estado.color}`}>
          {estado.texto}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {esCoordinador && version.estado === "borrador" && (
          <button
            disabled={cargando}
            onClick={() => accion(() => enviarAAprobacion(version.id))}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Enviar a aprobación
          </button>
        )}

        {esRector && version.estado === "pendiente_aprobacion" && !mostrarDevolucion && (
          <>
            <button
              disabled={cargando}
              onClick={() => accion(() => aprobarVersion(version.id, ""))}
              className="rounded-md bg-accent-teal px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              Aprobar
            </button>
            <button
              disabled={cargando}
              onClick={() => setMostrarDevolucion(true)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-accent-coral hover:bg-accent-coral/5"
            >
              Devolver para ajustes
            </button>
          </>
        )}

        {esCoordinador && version.estado === "aprobado" && (
          <button
            disabled={cargando}
            onClick={() => accion(() => publicarVersion(version.id))}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Publicar
          </button>
        )}
      </div>

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
              onClick={async () => {
                await accion(() => devolverVersion(version.id, comentario));
                setMostrarDevolucion(false);
              }}
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
