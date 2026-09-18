"use server";

import { revalidatePath } from "next/cache";
import { createClient, getPerfilActual } from "@/lib/supabase/server";
import { registrarAuditoria } from "@/lib/auditoria";

export async function enviarAAprobacion(versionId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("versiones_horario")
    .update({ estado: "pendiente_aprobacion" })
    .eq("id", versionId)
    .eq("estado", "borrador");

  if (error) return { error: error.message };
  await registrarAuditoria("enviar_a_aprobacion", "version_horario", versionId);
  revalidatePath("/versiones");
  return { error: null };
}

export async function aprobarVersion(versionId: string, comentario: string) {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No se encontró tu sesión." };

  const supabase = createClient();

  const { error: errUpdate } = await supabase
    .from("versiones_horario")
    .update({ estado: "aprobado" })
    .eq("id", versionId);

  if (errUpdate) return { error: errUpdate.message };

  const { error: errInsert } = await supabase.from("aprobaciones_horario").insert({
    version_id: versionId,
    rector_id: perfil.id,
    decision: "aprobado",
    comentario: comentario || null,
  });

  if (errInsert) return { error: errInsert.message };

  await registrarAuditoria("aprobar_version", "version_horario", versionId, { comentario });
  revalidatePath("/versiones");
  return { error: null };
}

export async function devolverVersion(versionId: string, comentario: string) {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No se encontró tu sesión." };
  if (!comentario.trim()) return { error: "Debes explicar por qué se devuelve el horario." };

  const supabase = createClient();

  const { error: errUpdate } = await supabase
    .from("versiones_horario")
    .update({ estado: "devuelto" })
    .eq("id", versionId);

  if (errUpdate) return { error: errUpdate.message };

  const { error: errInsert } = await supabase.from("aprobaciones_horario").insert({
    version_id: versionId,
    rector_id: perfil.id,
    decision: "devuelto",
    comentario,
  });

  if (errInsert) return { error: errInsert.message };

  await registrarAuditoria("devolver_version", "version_horario", versionId, { comentario });
  revalidatePath("/versiones");
  return { error: null };
}

export async function publicarVersion(versionId: string) {
  const supabase = createClient();

  const { data: version } = await supabase
    .from("versiones_horario")
    .select("institucion_id, anio_lectivo, estado")
    .eq("id", versionId)
    .single();

  if (!version) return { error: "No se encontró la versión." };
  if (version.estado !== "aprobado") {
    return { error: "Solo se puede publicar una versión que ya fue aprobada por el rector." };
  }

  // Al publicar esta versión, cualquier otra versión publicada de la misma
  // institución/año queda archivada (vuelve a "aprobado") para que solo haya
  // una versión activa a la vez.
  await supabase
    .from("versiones_horario")
    .update({ estado: "aprobado" })
    .eq("institucion_id", version.institucion_id)
    .eq("anio_lectivo", version.anio_lectivo)
    .eq("estado", "publicado");

  const { error } = await supabase
    .from("versiones_horario")
    .update({ estado: "publicado" })
    .eq("id", versionId);

  if (error) return { error: error.message };

  await registrarAuditoria("publicar_version", "version_horario", versionId);
  revalidatePath("/versiones");
  revalidatePath("/dashboard");
  return { error: null };
}
