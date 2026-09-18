"use server";

import { revalidatePath } from "next/cache";
import { createClient, getPerfilActual } from "@/lib/supabase/server";
import { registrarAuditoria } from "@/lib/auditoria";

export async function crearGrupo(formData: FormData) {
  const perfil = await getPerfilActual();
  if (!perfil?.institucion_id) return { error: "No se encontró tu institución." };

  const nombre = String(formData.get("nombre") || "").trim();
  const grado_id = String(formData.get("grado_id") || "");
  const jornada = String(formData.get("jornada") || "") || null;
  const anio_lectivo = Number(formData.get("anio_lectivo") || new Date().getFullYear());
  const codigo_grupo = String(formData.get("codigo_grupo") || "").trim();

  if (!nombre) return { error: "El nombre del grupo es obligatorio." };
  if (!grado_id) return { error: "Debes seleccionar un grado." };
  if (!codigo_grupo) return { error: "El código del grupo es obligatorio (debe ser único)." };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("grupos")
    .insert({
      institucion_id: perfil.institucion_id,
      grado_id,
      nombre,
      jornada,
      anio_lectivo,
      codigo_grupo,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un grupo con el código "${codigo_grupo}".` };
    }
    return { error: error.message };
  }

  await registrarAuditoria("crear", "grupo", data.id, { nombre, codigo_grupo });
  revalidatePath("/grupos");
  return { error: null };
}

export async function eliminarGrupo(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("grupos").delete().eq("id", id);
  if (error) return { error: error.message };
  await registrarAuditoria("eliminar", "grupo", id);
  revalidatePath("/grupos");
  return { error: null };
}
