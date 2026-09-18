"use client";

import { useRef, useState } from "react";
import { crearAsignatura } from "./actions";

type Area = { id: string; nombre: string };

export function NuevaAsignaturaForm({ areas }: { areas: Area[] }) {
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(formData: FormData) {
    setCargando(true);
    setError(null);
    const resultado = await crearAsignatura(formData);
    setCargando(false);
    if (resultado?.error) {
      setError(resultado.error);
    } else {
      formRef.current?.reset();
    }
  }

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-card border border-border bg-card p-4 sm:grid-cols-4"
    >
      <input
        name="nombre"
        placeholder="Nombre de la asignatura"
        required
        className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400 sm:col-span-2"
      />
      <select
        name="area_id"
        required
        defaultValue=""
        className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400"
      >
        <option value="" disabled>
          Selecciona un área
        </option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre}
          </option>
        ))}
      </select>
      <input
        name="intensidad_horaria_semanal"
        type="number"
        min={1}
        placeholder="Horas/semana"
        className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400"
      />

      {error && <p className="sm:col-span-4 text-sm text-accent-coral">{error}</p>}

      <button
        type="submit"
        disabled={cargando}
        className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60 sm:col-span-4 sm:w-fit"
      >
        {cargando ? "Creando..." : "+ Agregar asignatura"}
      </button>
    </form>
  );
}
