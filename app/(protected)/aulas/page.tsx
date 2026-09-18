import { createClient, getPerfilActual } from "@/lib/supabase/server";
import { NuevaAulaForm } from "./nueva-aula-form";
import { FilaAula } from "./fila-aula";

export default async function AulasPage() {
  const perfil = await getPerfilActual();
  const supabase = createClient();

  const { data: aulas, error } = await supabase
    .from("aulas")
    .select("id, nombre, capacidad, sede, tipo, activa")
    .order("nombre");

  const puedeGestionar = perfil?.rol === "coordinador" || perfil?.rol === "superadmin";

  return (
    <div>
      <h1 className="mb-1 text-lg font-medium text-ink">Aulas</h1>
      <p className="mb-6 text-sm text-muted">
        Salones, laboratorios y espacios disponibles para el horario.
      </p>

      {puedeGestionar && <NuevaAulaForm />}

      {error && (
        <p className="mb-4 rounded-md bg-accent-coral/10 px-3 py-2 text-sm text-accent-coral">
          No se pudieron cargar las aulas: {error.message}
        </p>
      )}

      <div className="overflow-hidden rounded-card border border-border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Capacidad</th>
              <th className="px-3 py-2 font-medium">Sede</th>
              <th className="px-3 py-2 font-medium text-right">
                {puedeGestionar ? "Acciones" : "Estado"}
              </th>
            </tr>
          </thead>
          <tbody>
            {aulas && aulas.length > 0 ? (
              aulas.map((a) => (
                <FilaAula key={a.id} aula={a} puedeGestionar={puedeGestionar} />
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted">
                  Todavía no hay aulas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
