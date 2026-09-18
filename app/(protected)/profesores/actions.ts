"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function actualizarDocente(perfilId: string, formData: FormData) {
  const area_principal = String(formData.get("area_principal") || "").trim() || null;
  const informacion_profesional = String(formData.get("informacion_profesional") || "").trim() || null;

  const supabase = createClient();
  const { error } = await supabase
    .from("docentes")
    .update({ area_principal, informacion_profesional })
    .eq("perfil_id", perfilId);

  if (error) return { error: error.message };

  revalidatePath("/profesores");
  return { error: null };
}
