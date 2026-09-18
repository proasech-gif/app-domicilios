import { createClient, getPerfilActual } from "@/lib/supabase/server";
import { NuevaEmergenciaForm } from "./nueva-emergencia-form";
import { NuevaAlternativaForm } from "./nueva-alternativa-form";
import { FilaAlternativa } from "./fila-alternativa";

const DIAS: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

export default async function HorariosEmergentesPage() {
  const perfil = await getPerfilActual();
  const supabase = createClient();

  const [{ data: docentesRaw }, { data: emergenciasRaw, error }] = await Promise.all([
    supabase.from("docentes").select("perfil_id, perfiles ( nombre_completo )"),
    supabase
      .from("horarios_emergentes")
      .select(
        "id, motivo, fecha_inicio, duracion_dias, creado_en, tipo, estado, version_alternativa_id, versiones_horario ( puntuacion )"
      )
      .order("creado_en", { ascending: false }),
  ]);

  const docentes = (docentesRaw ?? []).map((d: any) => ({
    perfil_id: d.perfil_id,
    nombre_completo: d.perfiles?.nombre_completo ?? "—",
  }));

  const todasEmergencias = emergenciasRaw ?? [];
  const emergenciasSustitucion = todasEmergencias.filter((e: any) => e.tipo !== "horario_alternativo");
  const emergenciasAlternativas = todasEmergencias.filter((e: any) => e.tipo === "horario_alternativo");

  const emergenciaIds = emergenciasSustitucion.map((e) => e.id);

  const { data: clasesRaw } = await supabase
    .from("horario_emergente_clases")
    .select(
      "horario_emergente_id, dia_semana, sin_cubrir, franjas_horarias ( nombre ), docente_sustituto_id, asignaciones_docente ( grupos ( nombre ), asignaturas ( nombre ) )"
    )
    .in("horario_emergente_id", emergenciaIds.length > 0 ? emergenciaIds : ["00000000-0000-0000-0000-000000000000"]);

  const sustitutoIds = [
    ...new Set((clasesRaw ?? []).map((c: any) => c.docente_sustituto_id).filter(Boolean)),
  ];
  const { data: sustitutosRaw } =
    sustitutoIds.length > 0
      ? await supabase.from("perfiles").select("id, nombre_completo").in("id", sustitutoIds)
      : { data: [] };
  const nombreSustituto = new Map((sustitutosRaw ?? []).map((s) => [s.id, s.nombre_completo]));

  const clasesPorEmergencia = new Map<string, any[]>();
  for (const c of clasesRaw ?? []) {
    if (!clasesPorEmergencia.has(c.horario_emergente_id)) {
      clasesPorEmergencia.set(c.horario_emergente_id, []);
    }
    clasesPorEmergencia.get(c.horario_emergente_id)!.push(c);
  }

  const esRector = perfil?.rol === "rector" || perfil?.rol === "superadmin";

  return (
    <div>
      <h1 className="mb-1 text-lg font-medium text-ink">Horarios emergentes</h1>
      <p className="mb-6 text-sm text-muted">
        Cobertura temporal por ausencias, o una distribución completamente distinta para toda la
        institución durante un período — sin tocar el horario regular aprobado.
      </p>

      <NuevaEmergenciaForm docentes={docentes} />
      <NuevaAlternativaForm />

      {error && (
        <p className="mb-4 rounded-md bg-accent-coral/10 px-3 py-2 text-sm text-accent-coral">
          {error.message}
        </p>
      )}

      {emergenciasAlternativas.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Horarios alternativos completos
          </h2>
          <div className="space-y-3">
            {emergenciasAlternativas.map((e: any) => (
              <FilaAlternativa
                key={e.id}
                alternativa={{
                  id: e.id,
                  motivo: e.motivo,
                  fecha_inicio: e.fecha_inicio,
                  duracion_dias: e.duracion_dias,
                  estado: e.estado,
                  puntuacion: e.versiones_horario?.puntuacion ?? null,
                }}
                esRector={esRector}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        {emergenciasSustitucion.length > 0 && (
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Coberturas por ausencia
          </h2>
        )}
        <div className="space-y-4">
          {todasEmergencias.length === 0 && (
            <p className="text-sm text-muted">Todavía no se ha registrado ninguna emergencia.</p>
          )}

          {emergenciasSustitucion.map((e) => {
            const clases = clasesPorEmergencia.get(e.id) ?? [];
            return (
              <div key={e.id} className="rounded-card border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{e.motivo}</p>
                    <p className="text-xs text-muted">
                      Desde {e.fecha_inicio} · {e.duracion_dias} día(s)
                    </p>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {clases.map((c: any, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span>{c.sin_cubrir ? "🔴" : "🟢"}</span>
                      <span className="text-ink">
                        {DIAS[c.dia_semana]} · {c.franjas_horarias?.nombre} ·{" "}
                        {c.asignaciones_docente?.grupos?.nombre} —{" "}
                        {c.asignaciones_docente?.asignaturas?.nombre}
                      </span>
                      <span className="text-muted">
                        {c.sin_cubrir
                          ? "sin cubrir"
                          : `→ ${nombreSustituto.get(c.docente_sustituto_id) ?? "—"}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
