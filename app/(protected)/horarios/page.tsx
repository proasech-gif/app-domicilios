import { createClient, getPerfilActual } from "@/lib/supabase/server";
import { SelectorVista } from "./selector-vista";
import { MatrizHorario, type CeldaClase } from "./matriz-horario";

export default async function HorariosPage({
  searchParams,
}: {
  searchParams: { version?: string; vista?: string; entidad?: string };
}) {
  const perfil = await getPerfilActual();
  const supabase = createClient();
  if (!perfil?.institucion_id) return null;

  const [
    { data: institucion },
    { data: franjas },
    { data: versionesRaw },
    { data: gruposRaw },
    { data: docentesRaw },
    { data: aulasRaw },
  ] = await Promise.all([
    supabase.from("instituciones").select("dias_clase").eq("id", perfil.institucion_id).single(),
    supabase
      .from("franjas_horarias")
      .select("id, nombre, orden, es_bloque_clase")
      .eq("institucion_id", perfil.institucion_id)
      .order("orden"),
    supabase
      .from("versiones_horario")
      .select("id, numero_version, estado")
      .eq("institucion_id", perfil.institucion_id)
      .order("numero_version", { ascending: false }),
    supabase.from("grupos").select("id, nombre").order("nombre"),
    supabase.from("docentes").select("perfil_id, perfiles ( nombre_completo )"),
    supabase.from("aulas").select("id, nombre").order("nombre"),
  ]);

  const versiones = (versionesRaw ?? []).map((v) => ({
    id: v.id,
    etiqueta: `Versión ${v.numero_version} · ${v.estado}`,
  }));
  const grupos = (gruposRaw ?? []).map((g) => ({ id: g.id, etiqueta: g.nombre }));
  const profesores = (docentesRaw ?? []).map((d: any) => ({
    id: d.perfil_id,
    etiqueta: d.perfiles?.nombre_completo ?? "—",
  }));
  const aulas = (aulasRaw ?? []).map((a) => ({ id: a.id, etiqueta: a.nombre }));

  const versionId = searchParams.version || versiones[0]?.id;
  const vista = searchParams.vista || "grupo";
  const entidadId = searchParams.entidad || "";

  let clases: CeldaClase[] = [];

  if (versionId) {
    const { data: clasesRaw } = await supabase
      .from("horario_clases")
      .select(
        "id, dia_semana, franja_id, aula_id, aulas ( nombre ), asignaciones_docente ( grupo_id, docente_id, grupos ( nombre ), asignaturas ( nombre ), perfiles ( nombre_completo ) )"
      )
      .eq("version_id", versionId);

    const filtradas = (clasesRaw ?? []).filter((c: any) => {
      if (!entidadId) return true;
      if (vista === "grupo") return c.asignaciones_docente?.grupo_id === entidadId;
      if (vista === "profesor") return c.asignaciones_docente?.docente_id === entidadId;
      if (vista === "aula") return c.aula_id === entidadId;
      return true;
    });

    clases = filtradas.map((c: any) => {
      const asignaturaNombre = c.asignaciones_docente?.asignaturas?.nombre ?? "—";
      const grupoNombre = c.asignaciones_docente?.grupos?.nombre ?? "—";
      const docenteNombre = c.asignaciones_docente?.perfiles?.nombre_completo ?? "—";
      const aulaNombre = c.aulas?.nombre ?? "Sin aula";

      let lineaSecundaria = docenteNombre;
      if (vista === "profesor") lineaSecundaria = grupoNombre;
      if (vista === "aula") lineaSecundaria = `${grupoNombre} · ${docenteNombre}`;

      return {
        claseId: c.id,
        dia: c.dia_semana,
        franjaId: c.franja_id,
        lineaPrincipal: asignaturaNombre,
        lineaSecundaria,
        lineaTerciaria: vista === "aula" ? "" : aulaNombre,
      };
    });
  }

  const dias: number[] = institucion?.dias_clase ?? [1, 2, 3, 4, 5];
  const puedeEditar = perfil.rol === "coordinador" || perfil.rol === "superadmin";

  return (
    <div>
      <h1 className="mb-1 text-lg font-medium text-ink">Horarios</h1>
      <p className="mb-6 text-sm text-muted">
        {puedeEditar
          ? "Arrastra una clase para reubicarla — se valida al soltar."
          : "Consulta el horario por grupo, profesor o aula."}
      </p>

      <SelectorVista versiones={versiones} grupos={grupos} profesores={profesores} aulas={aulas} />

      {!versionId ? (
        <p className="text-sm text-muted">Todavía no hay ninguna versión de horario generada.</p>
      ) : !entidadId ? (
        <p className="text-sm text-muted">Selecciona {vista} para ver su horario.</p>
      ) : (
        <MatrizHorario
          franjas={franjas ?? []}
          dias={dias}
          clases={clases}
          puedeEditar={puedeEditar}
        />
      )}
    </div>
  );
}
