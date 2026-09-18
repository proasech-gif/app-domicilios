"use client";

import { useRef, useState } from "react";
import { crearHorarioEmergente } from "./actions";

type Docente = { perfil_id: string; nombre_completo: string };

type Resultado = { totalClases: number; cubiertas: number; sinCubrir: number };

export function NuevaEmergenciaForm({ docentes }: { docentes: Docente[] }) {
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(formData: FormData) {
    setCargando(true);
    setError(null);
    setResultado(null);
    const respuesta = await crearHorarioEmergente(formData);
    setCargando(false);
    if (respuesta.error) {
      setError(respuesta.error);
    } else if (respuesta.resultado) {
      setResultado(respuesta.resultado);
      formRef.current?.reset();
    }
  }

  return (
    <div className="mb-6 rounded-card border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium text-ink">Reportar ausencia y generar cobertura</h2>
      <form ref={formRef} action={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <select
          name="docente_ausente_id"
          required
          defaultValue=""
          className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400 sm:col-span-2"
        >
          <option value="" disabled>
            Docente ausente
          </option>
          {docentes.map((d) => (
            <option key={d.perfil_id} value={d.perfil_id}>
              {d.nombre_completo}
            </option>
          ))}
        </select>
        <input
          name="fecha_inicio"
          type="date"
          required
          className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
        <input
          name="duracion_dias"
          type="number"
          min={1}
          defaultValue={1}
          placeholder="Días"
          className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
        <input
          name="motivo"
          placeholder="Motivo (ej. incapacidad médica)"
          required
          className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400 sm:col-span-4"
        />

        {error && <p className="sm:col-span-4 text-sm text-accent-coral">{error}</p>}

        {resultado && (
          <div className="sm:col-span-4 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">
            Cobertura generada: {resultado.cubiertas} de {resultado.totalClases} clase(s) cubiertas
            {resultado.sinCubrir > 0 && (
              <span className="text-accent-coral"> · {resultado.sinCubrir} sin cubrir</span>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={cargando}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60 sm:col-span-4 sm:w-fit"
        >
          {cargando ? "Buscando sustitutos..." : "Generar cobertura de emergencia"}
        </button>
      </form>
    </div>
  );
}
