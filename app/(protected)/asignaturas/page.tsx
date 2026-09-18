import { createClient, getPerfilActual } from "@/lib/supabase/server";
import { NuevaAsignaturaForm } from "./nueva-asignatura-form";
import { FilaAsignatura } from "./fila-asignatura";

export default async function AsignaturasPage() {
  const perfil = await getPerfilActual();
  const supabase = createClient();

  const [{ data: asignaturas, error }, { data: areas }] = await Promise.all([
    supabase
      .from("asignaturas")
      .select("id, nombre, intensidad_horaria_semanal, areas ( nombre )")
      .order("nombre"),
    supabase.from("areas").select("id, nombre").order("nombre"),
  ]);

  const filas = (asignaturas ?? []).map((a: any) => ({
    id: a.id,
    nombre: a.nombre,
    intensidad_horaria_semanal: a.intensidad_horaria_semanal,
    area_nombre: a.areas?.nombre ?? "Sin área",
  }));

  const puedeGestionar = perfil?.rol === "coordinador" || perfil?.rol === "superadmin";

  return (
    <div>
      <h1 className="mb-1 text-lg font-medium text-ink">Asignaturas</h1>
      <p className="mb-6 text-sm text-muted">
        Materias que se dictan en la institución y su intensidad horaria semanal.
      </p>

      {puedeGestionar && <NuevaAsignaturaForm areas={areas ?? []} />}

      {error && (
        <p className="mb-4 rounded-md bg-accent-coral/10 px-3 py-2 text-sm text-accent-coral">
          No se pudieron cargar las asignaturas: {error.message}
        </p>
      )}

      <div className="overflow-hidden rounded-card border border-border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Área</th>
              <th className="px-3 py-2 font-medium">Intensidad</th>
              <th className="px-3 py-2 font-medium text-right">{puedeGestionar ? "Acciones" : ""}</th>
            </tr>
          </thead>
          <tbody>
            {filas.length > 0 ? (
              filas.map((a) => (
                <FilaAsignatura key={a.id} asignatura={a} puedeGestionar={puedeGestionar} />
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted">
                  Todavía no hay asignaturas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
