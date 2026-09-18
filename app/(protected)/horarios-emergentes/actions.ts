"use server";

import { revalidatePath } from "next/cache";
import { createClient, getPerfilActual } from "@/lib/supabase/server";
import { docenteDisponible } from "@/lib/motor/restricciones";
import { generarVersionParaInstitucion } from "@/lib/motor/generar-y-guardar";
import { registrarAuditoria } from "@/lib/auditoria";

type ClaseAfectada = {
  asignacion_id: string;
  dia_semana: number;
  franja_id: string;
  aula_id: string | null;
  grupo_id: string;
  asignatura_id: string;
  area_id: string;
};

/** Convierte una fecha calendario a nuestro esquema de día 1(lunes)-6(sábado). 0 = domingo (sin clase). */
function diaSemanaDeFecha(fecha: Date): number {
  const dia = fecha.getDay(); // 0=domingo ... 6=sábado
  return dia === 0 ? -1 : dia;
}

export async function crearHorarioEmergente(formData: FormData) {
  const perfil = await getPerfilActual();
  if (!perfil?.institucion_id) return { error: "No se encontró tu institución.", resultado: null };

  const motivo = String(formData.get("motivo") || "").trim();
  const fechaInicioStr = String(formData.get("fecha_inicio") || "");
  const duracionDias = Number(formData.get("duracion_dias") || 1);
  const docenteAusenteId = String(formData.get("docente_ausente_id") || "");

  if (!motivo) return { error: "Describe el motivo de la emergencia.", resultado: null };
  if (!fechaInicioStr) return { error: "La fecha de inicio es obligatoria.", resultado: null };
  if (!docenteAusenteId) return { error: "Selecciona el docente ausente.", resultado: null };
  if (duracionDias < 1) return { error: "La duración debe ser de al menos 1 día.", resultado: null };

  const supabase = createClient();
  const institucionId = perfil.institucion_id;

  // Determina qué días de la semana (1-6) caen dentro del rango de la emergencia.
  const fechaInicio = new Date(fechaInicioStr + "T00:00:00");
  const diasAfectados = new Set<number>();
  for (let i = 0; i < duracionDias; i++) {
    const f = new Date(fechaInicio);
    f.setDate(f.getDate() + i);
    const d = diaSemanaDeFecha(f);
    if (d !== -1) diasAfectados.add(d);
  }

  if (diasAfectados.size === 0) {
    return { error: "El rango de fechas no incluye ningún día de clase (lunes a sábado).", resultado: null };
  }

  // Busca la versión de horario activa: prioriza "publicado" sobre "aprobado"
  // (alfabéticamente "publicado" > "aprobado", por eso el orden descendente).
  const { data: version } = await supabase
    .from("versiones_horario")
    .select("id, estado")
    .eq("institucion_id", institucionId)
    .in("estado", ["publicado", "aprobado"])
    .order("estado", { ascending: false })
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!version) {
    return {
      error:
        "No hay ninguna versión de horario aprobada o publicada todavía. Genera y aprueba un horario regular antes de crear uno emergente.",
      resultado: null,
    };
  }

  // Trae las clases del docente ausente en esa versión, para los días afectados.
  const { data: asignacionesDocente } = await supabase
    .from("asignaciones_docente")
    .select("id, grupo_id, asignatura_id, area_id")
    .eq("docente_id", docenteAusenteId)
    .eq("institucion_id", institucionId);

  const asignacionIds = (asignacionesDocente ?? []).map((a) => a.id);
  if (asignacionIds.length === 0) {
    return { error: "Ese docente no tiene ninguna asignación registrada.", resultado: null };
  }

  const { data: clasesRaw } = await supabase
    .from("horario_clases")
    .select("asignacion_id, dia_semana, franja_id, aula_id")
    .eq("version_id", version.id)
    .in("asignacion_id", asignacionIds)
    .in("dia_semana", [...diasAfectados]);

  if (!clasesRaw || clasesRaw.length === 0) {
    return {
      error: "El docente no tiene clases programadas en los días que cubre esta emergencia.",
      resultado: null,
    };
  }

  const asignacionesPorId = new Map((asignacionesDocente ?? []).map((a) => [a.id, a]));
  const clasesAfectadas: ClaseAfectada[] = clasesRaw.map((c) => {
    const asig = asignacionesPorId.get(c.asignacion_id)!;
    return {
      asignacion_id: c.asignacion_id,
      dia_semana: c.dia_semana,
      franja_id: c.franja_id,
      aula_id: c.aula_id,
      grupo_id: asig.grupo_id,
      asignatura_id: asig.asignatura_id,
      area_id: asig.area_id,
    };
  });

  // Candidatos a sustituto: docentes de la misma área, distintos del ausente.
  const areaIds = [...new Set(clasesAfectadas.map((c) => c.area_id))];
  const { data: candidatosRaw } = await supabase
    .from("asignaciones_docente")
    .select("docente_id, area_id")
    .in("area_id", areaIds)
    .eq("institucion_id", institucionId)
    .neq("docente_id", docenteAusenteId);

  const candidatosPorArea = new Map<string, Set<string>>();
  for (const c of candidatosRaw ?? []) {
    if (!candidatosPorArea.has(c.area_id)) candidatosPorArea.set(c.area_id, new Set());
    candidatosPorArea.get(c.area_id)!.add(c.docente_id);
  }
  const todosCandidatos = [...new Set((candidatosRaw ?? []).map((c) => c.docente_id))];

  const { data: disponibilidadRaw } = await supabase
    .from("disponibilidad_docentes")
    .select("docente_id, dia_semana, franja_id, disponible")
    .in("docente_id", todosCandidatos.length > 0 ? todosCandidatos : ["00000000-0000-0000-0000-000000000000"]);

  const disponibilidad = new Map<string, Set<string>>();
  for (const fila of disponibilidadRaw ?? []) {
    if (!fila.disponible) continue;
    if (!disponibilidad.has(fila.docente_id)) disponibilidad.set(fila.docente_id, new Set());
    disponibilidad.get(fila.docente_id)!.add(`${fila.dia_semana}-${fila.franja_id}`);
  }

  // Todas las clases (de cualquier docente) en esa versión, para revisar que
  // el sustituto no esté ya ocupado en ese día/franja.
  const { data: todasLasClases } = await supabase
    .from("horario_clases")
    .select("asignacion_id, dia_semana, franja_id")
    .eq("version_id", version.id);

  const { data: todasAsignaciones } = await supabase
    .from("asignaciones_docente")
    .select("id, docente_id")
    .eq("institucion_id", institucionId);
  const docentePorAsignacion = new Map((todasAsignaciones ?? []).map((a) => [a.id, a.docente_id]));

  const ocupadoEnHorarioRegular = (docenteId: string, dia: number, franjaId: string) =>
    (todasLasClases ?? []).some(
      (c) =>
        c.dia_semana === dia &&
        c.franja_id === franjaId &&
        docentePorAsignacion.get(c.asignacion_id) === docenteId
    );

  const ocupadosEnEstaEmergencia = new Set<string>(); // `${docenteId}-${dia}-${franjaId}`

  const coberturas: {
    asignacion_id: string;
    dia_semana: number;
    franja_id: string;
    aula_id: string | null;
    docente_sustituto_id: string | null;
    sin_cubrir: boolean;
  }[] = [];

  for (const clase of clasesAfectadas) {
    const candidatosArea = [...(candidatosPorArea.get(clase.area_id) ?? [])];
    let sustituto: string | null = null;

    for (const candidato of candidatosArea) {
      if (!docenteDisponible(disponibilidad, candidato, clase.dia_semana, clase.franja_id)) continue;
      if (ocupadoEnHorarioRegular(candidato, clase.dia_semana, clase.franja_id)) continue;
      if (ocupadosEnEstaEmergencia.has(`${candidato}-${clase.dia_semana}-${clase.franja_id}`)) continue;

      sustituto = candidato;
      break;
    }

    if (sustituto) {
      ocupadosEnEstaEmergencia.add(`${sustituto}-${clase.dia_semana}-${clase.franja_id}`);
    }

    coberturas.push({
      asignacion_id: clase.asignacion_id,
      dia_semana: clase.dia_semana,
      franja_id: clase.franja_id,
      aula_id: clase.aula_id,
      docente_sustituto_id: sustituto,
      sin_cubrir: !sustituto,
    });
  }

  const { data: emergenciaCreada, error: errEmergencia } = await supabase
    .from("horarios_emergentes")
    .insert({
      institucion_id: institucionId,
      creado_por: perfil.id,
      motivo,
      fecha_inicio: fechaInicioStr,
      duracion_dias: duracionDias,
    })
    .select("id")
    .single();

  if (errEmergencia || !emergenciaCreada) {
    return { error: errEmergencia?.message ?? "No se pudo crear la emergencia.", resultado: null };
  }

  const { error: errClases } = await supabase.from("horario_emergente_clases").insert(
    coberturas.map((c) => ({
      horario_emergente_id: emergenciaCreada.id,
      ...c,
    }))
  );

  if (errClases) return { error: errClases.message, resultado: null };

  await registrarAuditoria("crear_cobertura_emergente", "horario_emergente", emergenciaCreada.id, {
    motivo,
    docente_ausente_id: docenteAusenteId,
    cubiertas: coberturas.filter((c) => !c.sin_cubrir).length,
    sinCubrir: coberturas.filter((c) => c.sin_cubrir).length,
  });

  revalidatePath("/horarios-emergentes");

  return {
    error: null,
    resultado: {
      id: emergenciaCreada.id,
      totalClases: coberturas.length,
      cubiertas: coberturas.filter((c) => !c.sin_cubrir).length,
      sinCubrir: coberturas.filter((c) => c.sin_cubrir).length,
    },
  };
}

/**
 * Genera un horario COMPLETO alternativo para toda la institución, corriendo
 * el mismo motor CSP que el generador regular (todos los docentes presentes),
 * pero guardado como una emergencia con vigencia limitada a un rango de
 * fechas — para casos como obras, eventos especiales, etc., donde se
 * necesita una distribución distinta a la habitual sin que nadie falte.
 */
export async function generarHorarioAlternativoCompleto(formData: FormData) {
  const perfil = await getPerfilActual();
  if (!perfil?.institucion_id) return { error: "No se encontró tu institución.", resultado: null };

  const motivo = String(formData.get("motivo") || "").trim();
  const fechaInicioStr = String(formData.get("fecha_inicio") || "");
  const duracionDias = Number(formData.get("duracion_dias") || 1);

  if (!motivo) return { error: "Describe el motivo del horario alternativo.", resultado: null };
  if (!fechaInicioStr) return { error: "La fecha de inicio es obligatoria.", resultado: null };
  if (duracionDias < 1) return { error: "La duración debe ser de al menos 1 día.", resultado: null };

  const { error: errMotor, resultado: resultadoMotor } = await generarVersionParaInstitucion(
    perfil.institucion_id,
    perfil.id
  );

  if (errMotor || !resultadoMotor) {
    return { error: errMotor ?? "No se pudo generar el horario alternativo.", resultado: null };
  }

  const supabase = createClient();
  const { data: emergenciaCreada, error: errEmergencia } = await supabase
    .from("horarios_emergentes")
    .insert({
      institucion_id: perfil.institucion_id,
      creado_por: perfil.id,
      motivo,
      fecha_inicio: fechaInicioStr,
      duracion_dias: duracionDias,
      tipo: "horario_alternativo",
      version_alternativa_id: resultadoMotor.versionId,
      estado: "pendiente_aprobacion",
    })
    .select("id")
    .single();

  if (errEmergencia || !emergenciaCreada) {
    return { error: errEmergencia?.message ?? "No se pudo registrar la emergencia.", resultado: null };
  }

  await registrarAuditoria("generar_horario_alternativo", "horario_emergente", emergenciaCreada.id, {
    motivo,
    fecha_inicio: fechaInicioStr,
    duracion_dias: duracionDias,
    puntuacion: resultadoMotor.puntuacion,
  });

  revalidatePath("/horarios-emergentes");

  return {
    error: null,
    resultado: {
      id: emergenciaCreada.id,
      puntuacion: resultadoMotor.puntuacion,
      totalClases: resultadoMotor.totalClases,
      conflictos: resultadoMotor.conflictos.length,
    },
  };
}

export async function aprobarEmergencia(id: string, comentario: string) {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No se encontró tu sesión." };

  const supabase = createClient();
  const { error } = await supabase
    .from("horarios_emergentes")
    .update({
      estado: "aprobado",
      aprobado_por: perfil.id,
      aprobado_en: new Date().toISOString(),
      comentario_aprobacion: comentario || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  await registrarAuditoria("aprobar_horario_emergente", "horario_emergente", id, { comentario });
  revalidatePath("/horarios-emergentes");
  return { error: null };
}

export async function devolverEmergencia(id: string, comentario: string) {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No se encontró tu sesión." };
  if (!comentario.trim()) return { error: "Explica por qué se devuelve." };

  const supabase = createClient();
  const { error } = await supabase
    .from("horarios_emergentes")
    .update({
      estado: "devuelto",
      aprobado_por: perfil.id,
      aprobado_en: new Date().toISOString(),
      comentario_aprobacion: comentario,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  await registrarAuditoria("devolver_horario_emergente", "horario_emergente", id, { comentario });
  revalidatePath("/horarios-emergentes");
  return { error: null };
}
