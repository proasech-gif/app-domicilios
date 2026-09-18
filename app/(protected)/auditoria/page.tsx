import { createClient, getPerfilActual } from "@/lib/supabase/server";

const ETIQUETA_ACCION: Record<string, string> = {
  crear: "Creó",
  editar: "Editó",
  eliminar: "Eliminó",
  generar_horario: "Generó un horario",
  enviar_a_aprobacion: "Envió a aprobación",
  aprobar_version: "Aprobó una versión",
  devolver_version: "Devolvió una versión",
  publicar_version: "Publicó una versión",
  mover_clase: "Movió una clase",
  crear_cobertura_emergente: "Creó cobertura por ausencia",
  generar_horario_alternativo: "Generó un horario alternativo",
  aprobar_horario_emergente: "Aprobó un horario emergente",
  devolver_horario_emergente: "Devolvió un horario emergente",
};

const ETIQUETA_ENTIDAD: Record<string, string> = {
  aula: "aula",
  asignatura: "asignatura",
  grupo: "grupo",
  version_horario: "versión de horario",
  horario_clase: "clase",
  horario_emergente: "horario emergente",
};

export default async function AuditoriaPage() {
  const perfil = await getPerfilActual();
  const supabase = createClient();
  if (!perfil?.institucion_id) return null;

  const { data: registrosRaw, error } = await supabase
    .from("auditoria")
    .select("id, usuario_id, accion, entidad, entidad_id, detalle, creado_en")
    .eq("institucion_id", perfil.institucion_id)
    .order("creado_en", { ascending: false })
    .limit(100);

  const usuarioIds = [...new Set((registrosRaw ?? []).map((r) => r.usuario_id).filter(Boolean))];
  const { data: usuariosRaw } =
    usuarioIds.length > 0
      ? await supabase.from("perfiles").select("id, nombre_completo").in("id", usuarioIds)
      : { data: [] };
  const nombreUsuario = new Map((usuariosRaw ?? []).map((u) => [u.id, u.nombre_completo]));

  return (
    <div>
      <h1 className="mb-1 text-lg font-medium text-ink">Auditoría</h1>
      <p className="mb-6 text-sm text-muted">
        Registro de las acciones importantes realizadas en el sistema (últimas 100).
      </p>

      {error && (
        <p className="mb-4 rounded-md bg-accent-coral/10 px-3 py-2 text-sm text-accent-coral">
          {error.message}
        </p>
      )}

      {(!registrosRaw || registrosRaw.length === 0) && (
        <p className="text-sm text-muted">Todavía no hay registros de auditoría.</p>
      )}

      <div className="overflow-hidden rounded-card border border-border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">Usuario</th>
              <th className="px-3 py-2 font-medium">Acción</th>
              <th className="px-3 py-2 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {(registrosRaw ?? []).map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 align-top">
                <td className="px-3 py-2.5 text-sm text-ink">
                  {nombreUsuario.get(r.usuario_id) ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-sm text-muted">
                  {ETIQUETA_ACCION[r.accion] ?? r.accion}{" "}
                  {ETIQUETA_ENTIDAD[r.entidad] ? `(${ETIQUETA_ENTIDAD[r.entidad]})` : ""}
                  {r.detalle && Object.keys(r.detalle).length > 0 && (
                    <span className="block text-xs text-muted/80">
                      {Object.entries(r.detalle)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-sm text-muted">
                  {new Date(r.creado_en).toLocaleString("es-CO", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
