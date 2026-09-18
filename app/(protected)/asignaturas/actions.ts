"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registrarAuditoria } from "@/lib/auditoria";

export async function crearAsignatura(formData: FormData) {
  const nombre = String(formData.get("nombre") || "").trim();
  const area_id = String(formData.get("area_id") || "");
  const intensidad = formData.get("intensidad_horaria_semanal")
    ? Number(formData.get("intensidad_horaria_semanal"))
    : null;

  if (!nombre) return { error: "El nombre de la asignatura es obligatorio." };
  if (!area_id) return { error: "Debes seleccionar un área." };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("asignaturas")
    .insert({ nombre, area_id, intensidad_horaria_semanal: intensidad })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await registrarAuditoria("crear", "asignatura", data.id, { nombre });
  revalidatePath("/asignaturas");
  return { error: null };
}

export async function actualizarAsignatura(id: string, formData: FormData) {
  const nombre = String(formData.get("nombre") || "").trim();
  const intensidad = formData.get("intensidad_horaria_semanal")
    ? Number(formData.get("intensidad_horaria_semanal"))
    : null;

  if (!nombre) return { error: "El nombre es obligatorio." };

  const supabase = createClient();
  const { error } = await supabase
    .from("asignaturas")
    .update({ nombre, intensidad_horaria_semanal: intensidad })
    .eq("id", id);

  if (error) return { error: error.message };

  await registrarAuditoria("editar", "asignatura", id, { nombre });
  revalidatePath("/asignaturas");
  return { error: null };
}

export async function eliminarAsignatura(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("asignaturas").delete().eq("id", id);
  if (error) return { error: error.message };
  await registrarAuditoria("eliminar", "asignatura", id);
  revalidatePath("/asignaturas");
  return { error: null };
}
