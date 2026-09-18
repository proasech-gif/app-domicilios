"use client";

import { useRef, useState } from "react";
import { crearAula } from "./actions";

const TIPOS = [
  { value: "normal", label: "Normal" },
  { value: "laboratorio", label: "Laboratorio" },
  { value: "informatica", label: "Informática" },
  { value: "ingles", label: "Inglés" },
  { value: "educacion_fisica", label: "Educación física" },
  { value: "auditorio", label: "Auditorio" },
  { value: "especializada", label: "Especializada" },
];

export function NuevaAulaForm() {
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(formData: FormData) {
    setCargando(true);
    setError(null);
    const resultado = await crearAula(formData);
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
      className="mb-6 grid grid-cols-1 gap-3 rounded-card border border-border bg-card p-4 sm:grid-cols-5"
    >
      <input
        name="nombre"
        placeholder="Nombre del aula"
        required
        className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400 sm:col-span-2"
      />
      <input
        name="capacidad"
        type="number"
        min={1}
        placeholder="Capacidad"
        className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400"
      />
      <input
        name="sede"
        placeholder="Sede"
        className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400"
      />
      <select
        name="tipo"
        defaultValue="normal"
        className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400"
      >
        {TIPOS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      {error && (
        <p className="sm:col-span-5 text-sm text-accent-coral">{error}</p>
      )}

      <button
        type="submit"
        disabled={cargando}
        className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60 sm:col-span-5 sm:w-fit"
      >
        {cargando ? "Creando..." : "+ Agregar aula"}
      </button>
    </form>
  );
}
