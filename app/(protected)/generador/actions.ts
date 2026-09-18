"use server";

import { revalidatePath } from "next/cache";
import { getPerfilActual } from "@/lib/supabase/server";
import { generarVersionParaInstitucion } from "@/lib/motor/generar-y-guardar";
import { registrarAuditoria } from "@/lib/auditoria";

export async function generarHorarioAction() {
  const perfil = await getPerfilActual();
  if (!perfil?.institucion_id) {
    return { error: "No se encontró tu institución.", resultado: null };
  }

  const { error, resultado } = await generarVersionParaInstitucion(
    perfil.institucion_id,
    perfil.id
  );

  if (!error && resultado) {
    await registrarAuditoria("generar_horario", "version_horario", resultado.versionId, {
      puntuacion: resultado.puntuacion,
      totalClases: resultado.totalClases,
      conflictos: resultado.conflictos.length,
    });
    revalidatePath("/generador");
    revalidatePath("/versiones");
  }

  return { error, resultado };
}
