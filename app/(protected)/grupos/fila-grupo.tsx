"use client";

import { useState } from "react";
import { eliminarGrupo } from "./actions";

type Grupo = {
  id: string;
  nombre: string;
  codigo_grupo: string;
  jornada: string | null;
  anio_lectivo: number;
  grado_nombre: string;
};

export function FilaGrupo({ grupo, puedeGestionar }: { grupo: Grupo; puedeGestionar: boolean }) {
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function borrar() {
    if (!confirm(`¿Eliminar el grupo "${grupo.nombre}"?`)) return;
    setBorrando(true);
    const resultado = await eliminarGrupo(grupo.id);
    if (resultado?.error) {
      setError(resultado.error);
      setBorrando(false);
    }
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2.5 text-sm text-ink">{grupo.nombre}</td>
      <td className="px-3 py-2.5 text-sm text-muted">{grupo.grado_nombre}</td>
      <td className="px-3 py-2.5 text-sm text-muted">{grupo.codigo_grupo}</td>
      <td className="px-3 py-2.5 text-sm text-muted">{grupo.jornada ?? "—"}</td>
      <td className="px-3 py-2.5 text-sm text-muted">{grupo.anio_lectivo}</td>
      <td className="px-3 py-2.5 text-right text-sm">
        {puedeGestionar && (
          <button onClick={borrar} disabled={borrando} className="text-accent-coral hover:underline disabled:opacity-50">
            {borrando ? "Eliminando..." : "Eliminar"}
          </button>
        )}
        {error && <p className="text-accent-coral">{error}</p>}
      </td>
    </tr>
  );
}
