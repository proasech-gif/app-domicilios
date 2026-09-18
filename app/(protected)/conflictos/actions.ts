"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function marcarResuelto(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("conflictos_horario")
    .update({ resuelto: true })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/conflictos");
  return { error: null };
}
