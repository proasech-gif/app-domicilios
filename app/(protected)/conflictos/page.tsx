import { createClient, getPerfilActual } from "@/lib/supabase/server";
import { FilaConflicto } from "./fila-conflicto";

export default async function ConflictosPage() {
  const perfil = await getPerfilActual();
  const supabase = createClient();
  if (!perfil?.institucion_id) return null;

  const { data: versiones } = await supabase
    .from("versiones_horario")
    .select("id, numero_version")
    .eq("institucion_id", perfil.institucion_id);

  const versionIds = (versiones ?? []).map((v) => v.id);
  const etiquetaPorVersion = new Map((versiones ?? []).map((v) => [v.id, `Versión ${v.numero_version}`]));

  const { data: conflictosRaw, error } =
    versionIds.length > 0
      ? await supabase
          .from("conflictos_horario")
          .select("id, tipo, severidad, descripcion, resuelto, version_id, creado_en")
          .in("version_id", versionIds)
          .order("resuelto", { ascending: true })
          .order("severidad", { ascending: true })
          .order("creado_en", { ascending: false })
      : { data: [], error: null };

  const conflictos = (conflictosRaw ?? []).map((c) => ({
    id: c.id,
    tipo: c.tipo,
    severidad: c.severidad,
    descripcion: c.descripcion,
    resuelto: c.resuelto,
    version_etiqueta: etiquetaPorVersion.get(c.version_id) ?? "",
  }));

  const criticos = conflictos.filter((c) => !c.resuelto && c.severidad === "critico");
  const advertencias = conflictos.filter((c) => !c.resuelto && c.severidad === "advertencia");
  const resueltos = conflictos.filter((c) => c.resuelto);

  const puedeResolver = perfil.rol === "coordinador" || perfil.rol === "superadmin";

  return (
    <div>
      <h1 className="mb-1 text-lg font-medium text-ink">Centro de conflictos</h1>
      <p className="mb-6 text-sm text-muted">
        Problemas detectados en las versiones de horario generadas, de todas las versiones.
      </p>

      {error && (
        <p className="mb-4 rounded-md bg-accent-coral/10 px-3 py-2 text-sm text-accent-coral">
          {error.message}
        </p>
      )}

      {conflictos.length === 0 && (
        <p className="text-sm text-muted">No hay conflictos registrados todavía.</p>
      )}

      {criticos.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Críticos ({criticos.length})
          </h2>
          <div className="space-y-2">
            {criticos.map((c) => (
              <FilaConflicto key={c.id} conflicto={c} puedeResolver={puedeResolver} />
            ))}
          </div>
        </div>
      )}

      {advertencias.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Advertencias ({advertencias.length})
          </h2>
          <div className="space-y-2">
            {advertencias.map((c) => (
              <FilaConflicto key={c.id} conflicto={c} puedeResolver={puedeResolver} />
            ))}
          </div>
        </div>
      )}

      {resueltos.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Resueltos ({resueltos.length})
          </h2>
          <div className="space-y-2 opacity-60">
            {resueltos.map((c) => (
              <FilaConflicto key={c.id} conflicto={c} puedeResolver={puedeResolver} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
