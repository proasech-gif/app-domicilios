"use client";

import { useState } from "react";
import { actualizarAula, eliminarAula } from "./actions";

const TIPOS: Record<string, string> = {
  normal: "Normal",
  laboratorio: "Laboratorio",
  informatica: "Informática",
  ingles: "Inglés",
  educacion_fisica: "Educación física",
  auditorio: "Auditorio",
  especializada: "Especializada",
};

type Aula = {
  id: string;
  nombre: string;
  capacidad: number | null;
  sede: string | null;
  tipo: string;
  activa: boolean;
};

export function FilaAula({ aula, puedeGestionar }: { aula: Aula; puedeGestionar: boolean }) {
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(formData: FormData) {
    const resultado = await actualizarAula(aula.id, formData);
    if (resultado?.error) {
      setError(resultado.error);
    } else {
      setError(null);
      setEditando(false);
    }
  }

  async function borrar() {
    if (!confirm(`¿Eliminar el aula "${aula.nombre}"? Esta acción no se puede deshacer.`)) return;
    setBorrando(true);
    const resultado = await eliminarAula(aula.id);
    if (resultado?.error) {
      setError(resultado.error);
      setBorrando(false);
    }
  }

  if (editando) {
    return (
      <tr className="border-b border-border bg-brand-50/40">
        <td colSpan={5} className="p-3">
          <form action={guardar} className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            <input
              name="nombre"
              defaultValue={aula.nombre}
              required
              className="rounded-md border border-border px-2 py-1.5 text-sm sm:col-span-2"
            />
            <input
              name="capacidad"
              type="number"
              defaultValue={aula.capacidad ?? ""}
              className="rounded-md border border-border px-2 py-1.5 text-sm"
            />
            <input
              name="sede"
              defaultValue={aula.sede ?? ""}
              className="rounded-md border border-border px-2 py-1.5 text-sm"
            />
            <select
              name="tipo"
              defaultValue={aula.tipo}
              className="rounded-md border border-border px-2 py-1.5 text-sm"
            >
              {Object.entries(TIPOS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
              <input type="checkbox" name="activa" defaultChecked={aula.activa} />
              Activa
            </label>
            <div className="flex gap-2 sm:col-span-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                Guardar
              </button>
            </div>
            {error && <p className="sm:col-span-5 text-sm text-accent-coral">{error}</p>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2.5 text-sm text-ink">{aula.nombre}</td>
      <td className="px-3 py-2.5 text-sm text-muted">{TIPOS[aula.tipo] ?? aula.tipo}</td>
      <td className="px-3 py-2.5 text-sm text-muted">{aula.capacidad ?? "—"}</td>
      <td className="px-3 py-2.5 text-sm text-muted">{aula.sede ?? "—"}</td>
      <td className="px-3 py-2.5 text-right text-sm">
        {puedeGestionar ? (
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditando(true)} className="text-brand-600 hover:underline">
              Editar
            </button>
            <button
              onClick={borrar}
              disabled={borrando}
              className="text-accent-coral hover:underline disabled:opacity-50"
            >
              {borrando ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        ) : (
          <span className="text-muted">{aula.activa ? "Activa" : "Inactiva"}</span>
        )}
      </td>
    </tr>
  );
}
