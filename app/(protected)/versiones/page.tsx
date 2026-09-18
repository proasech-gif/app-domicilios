import { createClient, getPerfilActual } from "@/lib/supabase/server";
import { FilaVersion } from "./fila-version";

export default async function VersionesPage() {
  const perfil = await getPerfilActual();
  const supabase = createClient();

  const { data: versionesRaw, error } = await supabase
    .from("versiones_horario")
    .select("id, numero_version, estado, puntuacion, creado_por")
    .order("numero_version", { ascending: false });

  const creadorIds = [...new Set((versionesRaw ?? []).map((v) => v.creado_por).filter(Boolean))];
  const { data: creadoresRaw } =
    creadorIds.length > 0
      ? await supabase.from("perfiles").select("id, nombre_completo").in("id", creadorIds)
      : { data: [] };
  const nombreCreador = new Map((creadoresRaw ?? []).map((c) => [c.id, c.nombre_completo]));

  const versionIds = (versionesRaw ?? []).map((v) => v.id);
  const { data: conflictosRaw } =
    versionIds.length > 0
      ? await supabase
          .from("conflictos_horario")
          .select("version_id, severidad")
          .in("version_id", versionIds)
          .eq("severidad", "critico")
          .eq("resuelto", false)
      : { data: [] };

  const conflictosPorVersion = new Map<string, number>();
  for (const c of conflictosRaw ?? []) {
    conflictosPorVersion.set(c.version_id, (conflictosPorVersion.get(c.version_id) ?? 0) + 1);
  }

  const versiones = (versionesRaw ?? []).map((v) => ({
    id: v.id,
    numero_version: v.numero_version,
    estado: v.estado,
    puntuacion: v.puntuacion,
    conflictos_criticos: conflictosPorVersion.get(v.id) ?? 0,
    creador_nombre: nombreCreador.get(v.creado_por) ?? "—",
  }));

  const esCoordinador = perfil?.rol === "coordinador" || perfil?.rol === "superadmin";
  const esRector = perfil?.rol === "rector" || perfil?.rol === "superadmin";

  return (
    <div>
      <h1 className="mb-1 text-lg font-medium text-ink">Versiones del horario</h1>
      <p className="mb-6 text-sm text-muted">
        Cada horario generado queda como una versión. El coordinador la envía a aprobación, el
        rector la aprueba o la devuelve, y solo una versión aprobada puede publicarse.
      </p>

      {error && (
        <p className="mb-4 rounded-md bg-accent-coral/10 px-3 py-2 text-sm text-accent-coral">
          {error.message}
        </p>
      )}

      <div className="space-y-3">
        {versiones.length === 0 && (
          <p className="text-sm text-muted">
            Todavía no se ha generado ningún horario. Ve a "Generador de horarios" para crear el
            primero.
          </p>
        )}
        {versiones.map((v) => (
          <FilaVersion key={v.id} version={v} esCoordinador={esCoordinador} esRector={esRector} />
        ))}
      </div>
    </div>
  );
}
