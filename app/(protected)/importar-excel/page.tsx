import { createClient, getPerfilActual } from "@/lib/supabase/server";
import { Importador } from "./importador";

export default async function ImportarExcelPage() {
  const perfil = await getPerfilActual();
  const supabase = createClient();
  if (!perfil?.institucion_id) return null;

  const [{ data: areas }, { data: grados }, { data: docentesRaw }, { data: franjas }] = await Promise.all([
    supabase.from("areas").select("id, nombre").eq("institucion_id", perfil.institucion_id),
    supabase.from("grados").select("id, nombre").eq("institucion_id", perfil.institucion_id),
    supabase.from("docentes").select("perfil_id, perfiles ( nombre_completo )"),
    supabase.from("franjas_horarias").select("id, nombre").eq("institucion_id", perfil.institucion_id),
  ]);

  const docentes = (docentesRaw ?? []).map((d: any) => ({
    perfil_id: d.perfil_id,
    nombre_completo: d.perfiles?.nombre_completo ?? "",
  }));

  return (
    <div>
      <h1 className="mb-1 text-lg font-medium text-ink">Importar Excel</h1>
      <p className="mb-6 text-sm text-muted">
        Carga masiva de aulas, asignaturas, grupos o disponibilidad de docentes. Se valida todo
        antes de tocar la base de datos — si hay errores, no se importa nada.
      </p>

      <Importador
        referencias={{
          areas: areas ?? [],
          grados: grados ?? [],
          docentes,
          franjas: franjas ?? [],
        }}
      />
    </div>
  );
}
