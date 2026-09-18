import { createClient, getPerfilActual } from "@/lib/supabase/server";
import { NuevoGrupoForm } from "./nuevo-grupo-form";
import { FilaGrupo } from "./fila-grupo";

export default async function GruposPage() {
  const perfil = await getPerfilActual();
  const supabase = createClient();

  const [{ data: grupos, error }, { data: grados }] = await Promise.all([
    supabase
      .from("grupos")
      .select("id, nombre, codigo_grupo, jornada, anio_lectivo, grados ( nombre )")
      .order("nombre"),
    supabase.from("grados").select("id, nombre").order("nombre"),
  ]);

  const filas = (grupos ?? []).map((g: any) => ({
    id: g.id,
    nombre: g.nombre,
    codigo_grupo: g.codigo_grupo,
    jornada: g.jornada,
    anio_lectivo: g.anio_lectivo,
    grado_nombre: g.grados?.nombre ?? "Sin grado",
  }));

  const puedeGestionar = perfil?.rol === "coordinador" || perfil?.rol === "superadmin";

  return (
    <div>
      <h1 className="mb-1 text-lg font-medium text-ink">Grupos</h1>
      <p className="mb-6 text-sm text-muted">Grupos de estudiantes por grado y jornada.</p>

      {puedeGestionar && <NuevoGrupoForm grados={grados ?? []} />}

      {error && (
        <p className="mb-4 rounded-md bg-accent-coral/10 px-3 py-2 text-sm text-accent-coral">
          No se pudieron cargar los grupos: {error.message}
        </p>
      )}

      <div className="overflow-hidden rounded-card border border-border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">Grupo</th>
              <th className="px-3 py-2 font-medium">Grado</th>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Jornada</th>
              <th className="px-3 py-2 font-medium">Año lectivo</th>
              <th className="px-3 py-2 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {filas.length > 0 ? (
              filas.map((g) => <FilaGrupo key={g.id} grupo={g} puedeGestionar={puedeGestionar} />)
            ) : (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted">
                  Todavía no hay grupos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
