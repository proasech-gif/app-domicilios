"use client";

import { useRef, useState } from "react";
import { crearGrupo } from "./actions";

type Grado = { id: string; nombre: string };

export function NuevoGrupoForm({ grados }: { grados: Grado[] }) {
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(formData: FormData) {
    setCargando(true);
    setError(null);
    const resultado = await crearGrupo(formData);
    setCargando(false);
    if (resultado?.error) setError(resultado.error);
    else formRef.current?.reset();
  }

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-card border border-border bg-card p-4 sm:grid-cols-6"
    >
      <select name="grado_id" required defaultValue="" className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400">
        <option value="" disabled>
          Grado
        </option>
        {grados.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nombre}
          </option>
        ))}
      </select>
      <input name="nombre" placeholder="Nombre (ej. 6A)" required className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400" />
      <input name="codigo_grupo" placeholder="Código único" required className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400" />
      <select name="jornada" defaultValue="" className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400">
        <option value="">Jornada</option>
        <option value="manana">Mañana</option>
        <option value="tarde">Tarde</option>
        <option value="unica">Única</option>
        <option value="completa">Completa</option>
      </select>
      <input
        name="anio_lectivo"
        type="number"
        defaultValue={new Date().getFullYear()}
        className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400"
      />

      {error && <p className="sm:col-span-6 text-sm text-accent-coral">{error}</p>}

      <button
        type="submit"
        disabled={cargando}
        className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60 sm:col-span-6 sm:w-fit"
      >
        {cargando ? "Creando..." : "+ Agregar grupo"}
      </button>
    </form>
  );
}
