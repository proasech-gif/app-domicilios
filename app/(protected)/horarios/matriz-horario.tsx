"use client";

import { useState, useTransition } from "react";
import { moverClase } from "./actions";

const DIAS: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

type Franja = { id: string; nombre: string; orden: number; es_bloque_clase: boolean };

export type CeldaClase = {
  claseId: string;
  dia: number;
  franjaId: string;
  lineaPrincipal: string; // lo más relevante para la vista actual (ej. asignatura)
  lineaSecundaria: string; // lo segundo más relevante (ej. profesor / grupo)
  lineaTerciaria: string; // aula
};

export function MatrizHorario({
  franjas,
  dias,
  clases,
  puedeEditar,
}: {
  franjas: Franja[];
  dias: number[];
  clases: CeldaClase[];
  puedeEditar: boolean;
}) {
  const [claseArrastrada, setClaseArrastrada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const mapa = new Map<string, CeldaClase>();
  for (const c of clases) mapa.set(`${c.dia}-${c.franjaId}`, c);

  function onDrop(dia: number, franjaId: string) {
    if (!claseArrastrada || !puedeEditar) return;
    setError(null);
    startTransition(async () => {
      const resultado = await moverClase(claseArrastrada, dia, franjaId);
      if (resultado.error) setError(resultado.error);
      setClaseArrastrada(null);
    });
  }

  const franjasClase = franjas.filter((f) => f.es_bloque_clase);

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-md bg-accent-coral/10 px-3 py-2 text-sm text-accent-coral">
          {error}
        </div>
      )}
      {pendiente && <p className="mb-2 text-xs text-muted">Validando movimiento...</p>}

      <div className="overflow-x-auto rounded-card border border-border bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border-b border-r border-border bg-surface px-3 py-2 text-left text-xs font-medium text-muted">
                Hora
              </th>
              {dias.map((d) => (
                <th
                  key={d}
                  className="border-b border-border bg-surface px-3 py-2 text-left text-xs font-medium text-muted"
                >
                  {DIAS[d] ?? d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {franjasClase.map((f) => (
              <tr key={f.id}>
                <td className="border-r border-b border-border px-3 py-2 text-xs text-muted">
                  {f.nombre}
                </td>
                {dias.map((d) => {
                  const celda = mapa.get(`${d}-${f.id}`);
                  return (
                    <td
                      key={d}
                      onDragOver={(e) => puedeEditar && e.preventDefault()}
                      onDrop={() => onDrop(d, f.id)}
                      className="border-b border-border px-1.5 py-1.5 align-top"
                    >
                      {celda ? (
                        <div
                          draggable={puedeEditar}
                          onDragStart={() => setClaseArrastrada(celda.claseId)}
                          className={`rounded-md border border-brand-100 bg-brand-50 px-2 py-1.5 text-xs ${
                            puedeEditar ? "cursor-move" : ""
                          }`}
                        >
                          <p className="font-medium text-brand-700">{celda.lineaPrincipal}</p>
                          <p className="text-muted">{celda.lineaSecundaria}</p>
                          <p className="text-muted">{celda.lineaTerciaria}</p>
                        </div>
                      ) : (
                        <div className="h-14 rounded-md border border-dashed border-border/60" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
