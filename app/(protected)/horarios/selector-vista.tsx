"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Opcion = { id: string; etiqueta: string };

export function SelectorVista({
  versiones,
  grupos,
  profesores,
  aulas,
}: {
  versiones: Opcion[];
  grupos: Opcion[];
  profesores: Opcion[];
  aulas: Opcion[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const versionActual = searchParams.get("version") ?? versiones[0]?.id ?? "";
  const vistaActual = searchParams.get("vista") ?? "grupo";
  const entidadActual = searchParams.get("entidad") ?? "";

  function actualizar(cambios: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    router.push(`/horarios?${params.toString()}`);
  }

  const opcionesEntidad = vistaActual === "grupo" ? grupos : vistaActual === "profesor" ? profesores : aulas;

  return (
    <div className="mb-4 flex flex-wrap gap-3">
      <select
        value={versionActual}
        onChange={(e) => actualizar({ version: e.target.value })}
        className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400"
      >
        {versiones.map((v) => (
          <option key={v.id} value={v.id}>
            {v.etiqueta}
          </option>
        ))}
      </select>

      <select
        value={vistaActual}
        onChange={(e) => actualizar({ vista: e.target.value, entidad: "" })}
        className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400"
      >
        <option value="grupo">Por grupo</option>
        <option value="profesor">Por profesor</option>
        <option value="aula">Por aula</option>
      </select>

      <select
        value={entidadActual}
        onChange={(e) => actualizar({ entidad: e.target.value })}
        className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand-400"
      >
        <option value="">
          {opcionesEntidad.length === 0 ? "Sin opciones" : `Selecciona ${vistaActual}`}
        </option>
        {opcionesEntidad.map((o) => (
          <option key={o.id} value={o.id}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </div>
  );
}
