"use client";

import { useState } from "react";
import { actualizarAsignatura, eliminarAsignatura } from "./actions";

type Asignatura = {
  id: string;
  nombre: string;
  intensidad_horaria_semanal: number | null;
  area_nombre: string;
};

export function FilaAsignatura({
  asignatura,
  puedeGestionar,
}: {
  asignatura: Asignatura;
  puedeGestionar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(formData: FormData) {
    const resultado = await actualizarAsignatura(asignatura.id, formData);
    if (resultado?.error) setError(resultado.error);
    else {
      setError(null);
      setEditando(false);
    }
  }

  async function borrar() {
    if (!confirm(`¿Eliminar "${asignatura.nombre}"?`)) return;
    setBorrando(true);
    const resultado = await eliminarAsignatura(asignatura.id);
    if (resultado?.error) {
      setError(resultado.error);
      setBorrando(false);
    }
  }

  if (editando) {
    return (
      <tr className="border-b border-border bg-brand-50/40">
        <td colSpan={4} className="p-3">
          <form action={guardar} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <input
              name="nombre"
              defaultValue={asignatura.nombre}
              required
              className="rounded-md border border-border px-2 py-1.5 text-sm sm:col-span-2"
            />
            <input
              name="intensidad_horaria_semanal"
              type="number"
              defaultValue={asignatura.intensidad_horaria_semanal ?? ""}
              className="rounded-md border border-border px-2 py-1.5 text-sm"
            />
            <div className="flex gap-2 sm:justify-end">
              <button type="button" onClick={() => setEditando(false)} className="rounded-md border border-border px-3 py-1.5 text-sm text-muted">
                Cancelar
              </button>
              <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                Guardar
              </button>
            </div>
            {error && <p className="sm:col-span-4 text-sm text-accent-coral">{error}</p>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2.5 text-sm text-ink">{asignatura.nombre}</td>
      <td className="px-3 py-2.5 text-sm text-muted">{asignatura.area_nombre}</td>
      <td className="px-3 py-2.5 text-sm text-muted">
        {asignatura.intensidad_horaria_semanal ? `${asignatura.intensidad_horaria_semanal} h/sem` : "Sin definir"}
      </td>
      <td className="px-3 py-2.5 text-right text-sm">
        {puedeGestionar ? (
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditando(true)} className="text-brand-600 hover:underline">
              Editar
            </button>
            <button onClick={borrar} disabled={borrando} className="text-accent-coral hover:underline disabled:opacity-50">
              {borrando ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        ) : null}
      </td>
    </tr>
  );
}
