"use client";

import { useState } from "react";
import { actualizarDocente } from "./actions";

type Profesor = {
  perfil_id: string;
  nombre_completo: string;
  correo: string;
  area_principal: string | null;
  horas_asignadas: number;
};

export function FilaProfesor({ profesor, puedeGestionar }: { profesor: Profesor; puedeGestionar: boolean }) {
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(formData: FormData) {
    const resultado = await actualizarDocente(profesor.perfil_id, formData);
    if (resultado?.error) setError(resultado.error);
    else {
      setError(null);
      setEditando(false);
    }
  }

  if (editando) {
    return (
      <tr className="border-b border-border bg-brand-50/40">
        <td colSpan={4} className="p-3">
          <form action={guardar} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <input
              name="area_principal"
              placeholder="Área principal"
              defaultValue={profesor.area_principal ?? ""}
              className="rounded-md border border-border px-2 py-1.5 text-sm"
            />
            <input
              name="informacion_profesional"
              placeholder="Información profesional"
              className="rounded-md border border-border px-2 py-1.5 text-sm sm:col-span-2"
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
      <td className="px-3 py-2.5 text-sm text-ink">{profesor.nombre_completo}</td>
      <td className="px-3 py-2.5 text-sm text-muted">{profesor.correo}</td>
      <td className="px-3 py-2.5 text-sm text-muted">{profesor.area_principal ?? "Sin definir"}</td>
      <td className="px-3 py-2.5 text-sm text-muted">{profesor.horas_asignadas} h/sem asignadas</td>
      <td className="px-3 py-2.5 text-right text-sm">
        {puedeGestionar && (
          <button onClick={() => setEditando(true)} className="text-brand-600 hover:underline">
            Editar
          </button>
        )}
      </td>
    </tr>
  );
}
