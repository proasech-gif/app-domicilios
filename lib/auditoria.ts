import { createClient, getPerfilActual } from "@/lib/supabase/server";

/**
 * Registra una entrada de auditoría. Se llama desde dentro de los server
 * actions que hacen cambios importantes (crear/editar/eliminar, aprobar,
 * generar horarios, mover clases, etc.). Si falla el registro, NO bloquea
 * la operación principal — solo se registra en consola, para no convertir
 * la auditoría en un punto único de falla.
 */
export async function registrarAuditoria(
  accion: string,
  entidad: string,
  entidadId: string | null,
  detalle?: Record<string, unknown>
) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return;

    const supabase = createClient();
    await supabase.from("auditoria").insert({
      usuario_id: perfil.id,
      institucion_id: perfil.institucion_id,
      accion,
      entidad,
      entidad_id: entidadId,
      detalle: detalle ?? null,
    });
  } catch (err) {
    console.error("No se pudo registrar auditoría:", err);
  }
}
