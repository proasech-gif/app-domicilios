"use server";

import { revalidatePath } from "next/cache";
import { createClient, getPerfilActual } from "@/lib/supabase/server";
import { registrarAuditoria } from "@/lib/auditoria";

export async function crearAula(formData: FormData) {
  const perfil = await getPerfilActual();
  if (!perfil?.institucion_id) return { error: "No se encontró tu institución." };

  const nombre = String(formData.get("nombre") || "").trim();
  const capacidad = formData.get("capacidad") ? Number(formData.get("capacidad")) : null;
  const sede = String(formData.get("sede") || "").trim() || null;
  const tipo = String(formData.get("tipo") || "normal");

  if (!nombre) return { error: "El nombre del aula es obligatorio." };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("aulas")
    .insert({ institucion_id: perfil.institucion_id, nombre, capacidad, sede, tipo })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await registrarAuditoria("crear", "aula", data.id, { nombre, tipo });
  revalidatePath("/aulas");
  return { error: null };
}

export async function eliminarAula(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("aulas").delete().eq("id", id);
  if (error) return { error: error.message };
  await registrarAuditoria("eliminar", "aula", id);
  revalidatePath("/aulas");
  return { error: null };
}

export async function actualizarAula(id: string, formData: FormData) {
  const nombre = String(formData.get("nombre") || "").trim();
  const capacidad = formData.get("capacidad") ? Number(formData.get("capacidad")) : null;
  const sede = String(formData.get("sede") || "").trim() || null;
  const tipo = String(formData.get("tipo") || "normal");
  const activa = formData.get("activa") === "on";

  if (!nombre) return { error: "El nombre del aula es obligatorio." };

  const supabase = createClient();
  const { error } = await supabase
    .from("aulas")
    .update({ nombre, capacidad, sede, tipo, activa })
    .eq("id", id);

  if (error) return { error: error.message };

  await registrarAuditoria("editar", "aula", id, { nombre, tipo, activa });
  revalidatePath("/aulas");
  return { error: null };
}
