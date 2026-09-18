import { createClient, getPerfilActual } from "@/lib/supabase/server";
import { FilaProfesor } from "./fila-profesor";

export default async function ProfesoresPage() {
  const perfil = await getPerfilActual();
  const supabase = createClient();

  const [{ data: docentes, error }, { data: asignaciones }] = await Promise.all([
    supabase
      .from("docentes")
      .select("perfil_id, area_principal, perfiles ( nombre_completo, correo )"),
    supabase.from("asignaciones_docente").select("docente_id, horas_semanales"),
  ]);

  const horasPorDocente = new Map<string, number>();
  for (const a of asignaciones ?? []) {
    horasPorDocente.set(a.docente_id, (horasPorDocente.get(a.docente_id) ?? 0) + a.horas_semanales);
  }

  const filas = (docentes ?? []).map((d: any) => ({
    perfil_id: d.perfil_id,
    nombre_completo: d.perfiles?.nombre_completo ?? "—",
    correo: d.perfiles?.correo ?? "—",
    area_principal: d.area_principal,
    horas_asignadas: horasPorDocente.get(d.perfil_id) ?? 0,
  }));

  const puedeGestionar = perfil?.rol === "coordinador" || perfil?.rol === "superadmin";

  return (
    <div>
      <h1 className="mb-1 text-lg font-medium text-ink">Profesores</h1>
      <p className="mb-6 text-sm text-muted">
        Docentes de la institución y las horas semanales que ya tienen asignadas.
      </p>

      {puedeGestionar && (
        <div className="mb-6 rounded-card border border-border bg-card p-4 text-sm text-muted">
          <p>
            Para dar de alta un profesor <strong>nuevo</strong> hace falta un paso extra: crear su
            cuenta de acceso en Supabase Auth (correo + contraseña temporal), porque cada docente
            necesita poder iniciar sesión. Esto no se puede hacer solo con la clave pública del
            frontend por razones de seguridad. Lo dejamos para una fase siguiente si quieres que lo
            construyamos (un formulario que invite al profesor por correo).
          </p>
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-md bg-accent-coral/10 px-3 py-2 text-sm text-accent-coral">
          No se pudieron cargar los profesores: {error.message}
        </p>
      )}

      <div className="overflow-hidden rounded-card border border-border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Correo</th>
              <th className="px-3 py-2 font-medium">Área principal</th>
              <th className="px-3 py-2 font-medium">Carga horaria</th>
              <th className="px-3 py-2 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {filas.length > 0 ? (
              filas.map((p) => <FilaProfesor key={p.perfil_id} profesor={p} puedeGestionar={puedeGestionar} />)
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted">
                  Todavía no hay profesores registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
