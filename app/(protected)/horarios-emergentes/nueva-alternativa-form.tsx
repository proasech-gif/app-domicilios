"use client";

import { useRef, useState } from "react";
import { generarHorarioAlternativoCompleto } from "./actions";

type Resultado = { puntuacion: number; totalClases: number; conflictos: number };

export function NuevaAlternativaForm() {
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(formData: FormData) {
    setCargando(true);
    setError(null);
    setResultado(null);
    const respuesta = await generarHorarioAlternativoCompleto(formData);
    setCargando(false);
    if (respuesta.error) setError(respuesta.error);
    else if (respuesta.resultado) {
      setResultado(respuesta.resultado);
      formRef.current?.reset();
    }
  }

  return (
    <div className="mb-6 rounded-card border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-medium text-ink">
        Generar un horario alternativo completo
      </h2>
      <p className="mb-3 text-xs text-muted">
        Para cuando ningún docente falta, pero la institución necesita una distribución distinta
        a la habitual durante un período (obras, eventos, jornadas especiales). El motor corre
        desde cero, igual que en el generador regular.
      </p>
      <form ref={formRef} action={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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
          placeholder="Días de vigencia"
          className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
        <input
          name="motivo"
          placeholder="Motivo (ej. obras en el bloque B)"
          required
          className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400 sm:col-span-2"
        />

        {error && <p className="sm:col-span-4 text-sm text-accent-coral">{error}</p>}

        {resultado && (
          <div className="sm:col-span-4 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">
            Generado: {resultado.totalClases} clase(s) · Puntuación {resultado.puntuacion}/100
            {resultado.conflictos > 0 && (
              <span className="text-accent-coral"> · {resultado.conflictos} conflicto(s)</span>
            )}
            {" — "}queda pendiente de aprobación del rector.
          </div>
        )}

        <button
          type="submit"
          disabled={cargando}
          className="rounded-md border border-brand-600 px-3 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50 disabled:opacity-60 sm:col-span-4 sm:w-fit"
        >
          {cargando ? "Generando..." : "Generar horario alternativo completo"}
        </button>
      </form>
    </div>
  );
}
