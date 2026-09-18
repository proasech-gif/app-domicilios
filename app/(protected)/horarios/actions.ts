"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registrarAuditoria } from "@/lib/auditoria";

export type ResultadoMover = { error: string | null };

export async function moverClase(
  claseId: string,
  nuevoDia: number,
  nuevaFranjaId: string
): Promise<ResultadoMover> {
  const supabase = createClient();

  const { data: clase, error: errClase } = await supabase
    .from("horario_clases")
    .select("id, version_id, aula_id, asignacion_id, dia_semana, franja_id")
    .eq("id", claseId)
    .single();

  if (errClase || !clase) return { error: "No se encontró la clase a mover." };

  const { data: asignacion } = await supabase
    .from("asignaciones_docente")
    .select("docente_id, grupo_id")
    .eq("id", clase.asignacion_id)
    .single();

  if (!asignacion) return { error: "No se encontró la asignación de esta clase." };

  // Respeta la disponibilidad del docente, si está registrada.
  const { data: disponibilidadFila } = await supabase
    .from("disponibilidad_docentes")
    .select("disponible")
    .eq("docente_id", asignacion.docente_id)
    .eq("dia_semana", nuevoDia)
    .eq("franja_id", nuevaFranjaId)
    .maybeSingle();

  const { count: totalDisponibilidad } = await supabase
    .from("disponibilidad_docentes")
    .select("id", { count: "exact", head: true })
    .eq("docente_id", asignacion.docente_id);

  if ((totalDisponibilidad ?? 0) > 0 && (!disponibilidadFila || !disponibilidadFila.disponible)) {
    return {
      error: "❌ No se puede realizar: el docente no está disponible en ese día y franja.",
    };
  }

  // Trae todas las demás clases de la misma versión en el día/franja destino.
  const { data: clasesEnDestino } = await supabase
    .from("horario_clases")
    .select("id, aula_id, asignacion_id")
    .eq("version_id", clase.version_id)
    .eq("dia_semana", nuevoDia)
    .eq("franja_id", nuevaFranjaId)
    .neq("id", claseId);

  if (clasesEnDestino && clasesEnDestino.length > 0) {
    const asignacionIds = clasesEnDestino.map((c) => c.asignacion_id);
    const { data: asignacionesEnDestino } = await supabase
      .from("asignaciones_docente")
      .select("id, docente_id, grupo_id")
      .in("id", asignacionIds);

    const porId = new Map((asignacionesEnDestino ?? []).map((a) => [a.id, a]));

    for (const c of clasesEnDestino) {
      const asigDestino = porId.get(c.asignacion_id);
      if (!asigDestino) continue;

      if (asigDestino.docente_id === asignacion.docente_id) {
        return {
          error: "❌ No se puede realizar: el docente ya tiene otra clase en ese día y franja.",
        };
      }
      if (asigDestino.grupo_id === asignacion.grupo_id) {
        return {
          error: "❌ No se puede realizar: el grupo ya tiene otra clase en ese día y franja.",
        };
      }
      if (clase.aula_id && c.aula_id === clase.aula_id) {
        return {
          error: "❌ No se puede realizar: el aula ya está ocupada en ese día y franja.",
        };
      }
    }
  }

  const { error: errUpdate } = await supabase
    .from("horario_clases")
    .update({ dia_semana: nuevoDia, franja_id: nuevaFranjaId })
    .eq("id", claseId);

  if (errUpdate) return { error: errUpdate.message };

  await registrarAuditoria("mover_clase", "horario_clase", claseId, {
    dia_original: clase.dia_semana,
    franja_original: clase.franja_id,
    nuevo_dia: nuevoDia,
    nueva_franja: nuevaFranjaId,
  });

  revalidatePath("/horarios");
  return { error: null };
}
