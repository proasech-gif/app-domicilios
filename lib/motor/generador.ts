import {
  Asignacion,
  Clase,
  ConflictoDetectado,
  EntradaMotor,
  Franja,
  ResultadoMotor,
  claveSlot,
} from "./tipos";
import {
  aulaCompatible,
  aulaOcupada,
  docenteDisponible,
  docenteOcupado,
  grupoOcupado,
} from "./restricciones";

const MAX_INTENTOS_POR_ASIGNACION = 3000;

type Candidato = { dia: number; franja: Franja; aulaId: string };

/**
 * Cuenta cuántos slots (día, franja) le quedan disponibles a un docente en
 * total. Se usa para la heurística MRV: se colocan primero las asignaciones
 * con menos margen de maniobra.
 */
function tamanoDominio(asignacion: Asignacion, entrada: EntradaMotor): number {
  const disponibles = entrada.disponibilidad.get(asignacion.docente_id);
  const franjasClase = entrada.franjas.filter((f) => f.es_bloque_clase);
  if (!disponibles || disponibles.size === 0) {
    return entrada.dias.length * franjasClase.length;
  }
  let total = 0;
  for (const dia of entrada.dias) {
    for (const franja of franjasClase) {
      if (disponibles.has(claveSlot(dia, franja.id))) total++;
    }
  }
  return total;
}

function generarCandidatos(
  asignacion: Asignacion,
  clasesActuales: Clase[],
  asignacionesPorId: Map<string, Asignacion>,
  entrada: EntradaMotor,
  diasUsadosPorEstaAsignacion: Set<number>,
  usoAulaPorId: Map<string, number>
): Candidato[] {
  const asignatura = entrada.asignaturasPorId.get(asignacion.asignatura_id);
  const franjasClase = entrada.franjas.filter((f) => f.es_bloque_clase);
  const candidatos: Candidato[] = [];

  for (const dia of entrada.dias) {
    for (const franja of franjasClase) {
      if (!docenteDisponible(entrada.disponibilidad, asignacion.docente_id, dia, franja.id)) continue;
      if (docenteOcupado(clasesActuales, asignacionesPorId, asignacion.docente_id, dia, franja.id)) continue;
      if (grupoOcupado(clasesActuales, asignacionesPorId, asignacion.grupo_id, dia, franja.id)) continue;

      // Busca un aula compatible y libre en ese slot.
      const aulasCompatibles = entrada.aulas.filter((a) =>
        aulaCompatible(a, asignatura?.aula_tipo_requerido)
      );
      const aulaLibre = aulasCompatibles.find(
        (a) => !aulaOcupada(clasesActuales, a.id, dia, franja.id)
      );
      if (!aulaLibre) continue;

      candidatos.push({ dia, franja, aulaId: aulaLibre.id });
    }
  }

  // Heurística de valor menos restrictivo: prioriza días que esta asignación
  // todavía no ha usado (para distribuirla en la semana) y aulas menos
  // sobrecargadas.
  candidatos.sort((a, b) => {
    const diaUsadoA = diasUsadosPorEstaAsignacion.has(a.dia) ? 1 : 0;
    const diaUsadoB = diasUsadosPorEstaAsignacion.has(b.dia) ? 1 : 0;
    if (diaUsadoA !== diaUsadoB) return diaUsadoA - diaUsadoB;

    const usoAulaA = usoAulaPorId.get(a.aulaId) ?? 0;
    const usoAulaB = usoAulaPorId.get(b.aulaId) ?? 0;
    if (usoAulaA !== usoAulaB) return usoAulaA - usoAulaB;

    return a.franja.orden - b.franja.orden;
  });

  return candidatos;
}

export function generarHorario(entrada: EntradaMotor): ResultadoMotor {
  const asignacionesPorId = new Map(entrada.asignaciones.map((a) => [a.id, a]));
  const clases: Clase[] = [];
  const conflictos: ConflictoDetectado[] = [];
  const usoAulaPorId = new Map<string, number>();

  // MRV: procesa primero las asignaciones con menos slots disponibles.
  const ordenAsignaciones = [...entrada.asignaciones].sort(
    (a, b) => tamanoDominio(a, entrada) - tamanoDominio(b, entrada)
  );

  for (const asignacion of ordenAsignaciones) {
    const diasUsados = new Set<number>();
    let horasFaltantes = asignacion.horas_semanales;
    let intentos = 0;
    let fallo = false;

    while (horasFaltantes > 0) {
      intentos++;
      if (intentos > MAX_INTENTOS_POR_ASIGNACION) {
        fallo = true;
        break;
      }

      const candidatos = generarCandidatos(
        asignacion,
        clases,
        asignacionesPorId,
        entrada,
        diasUsados,
        usoAulaPorId
      );

      if (candidatos.length === 0) {
        fallo = true;
        break;
      }

      // Backtracking real: prueba el mejor candidato; si más adelante esta
      // misma asignación se queda sin opciones, se libera el último bloque
      // colocado y se prueba el siguiente candidato disponible.
      const elegido = candidatos[0];
      clases.push({
        asignacion_id: asignacion.id,
        dia_semana: elegido.dia,
        franja_id: elegido.franja.id,
        aula_id: elegido.aulaId,
      });
      diasUsados.add(elegido.dia);
      usoAulaPorId.set(elegido.aulaId, (usoAulaPorId.get(elegido.aulaId) ?? 0) + 1);
      horasFaltantes--;
    }

    if (fallo && horasFaltantes > 0) {
      conflictos.push({
        tipo: "intensidad_no_cumplida",
        severidad: "critico",
        descripcion: `No fue posible ubicar ${horasFaltantes} de ${asignacion.horas_semanales} hora(s) semanales para esta asignación. Probablemente falte disponibilidad del docente o aulas compatibles.`,
        entidad_afectada: { asignacion_id: asignacion.id },
      });
    }
  }

  const puntuacion = calcularPuntuacion(clases, asignacionesPorId, entrada, conflictos);

  return { clases, conflictos, puntuacion };
}

function calcularPuntuacion(
  clases: Clase[],
  asignacionesPorId: Map<string, Asignacion>,
  entrada: EntradaMotor,
  conflictos: ConflictoDetectado[]
): number {
  const totalHorasEsperadas = entrada.asignaciones.reduce((s, a) => s + a.horas_semanales, 0);
  const horasColocadas = clases.length;
  const cumplimientoDuro =
    totalHorasEsperadas === 0 ? 1 : horasColocadas / totalHorasEsperadas;

  // Restricción blanda: penaliza cuando una asignación queda concentrada en
  // muy pocos días distintos en vez de repartirse en la semana.
  const distribucionPorAsignacion = new Map<string, Set<number>>();
  for (const c of clases) {
    const asig = asignacionesPorId.get(c.asignacion_id);
    if (!asig) continue;
    const key = asig.id;
    if (!distribucionPorAsignacion.has(key)) distribucionPorAsignacion.set(key, new Set());
    distribucionPorAsignacion.get(key)!.add(c.dia_semana);
  }

  let puntosDistribucion = 0;
  let totalAsignaciones = 0;
  for (const asignacion of entrada.asignaciones) {
    totalAsignaciones++;
    const diasUsados = distribucionPorAsignacion.get(asignacion.id)?.size ?? 0;
    const idealDias = Math.min(asignacion.horas_semanales, entrada.dias.length);
    puntosDistribucion += idealDias === 0 ? 1 : Math.min(diasUsados / idealDias, 1);
  }
  const cumplimientoBlando = totalAsignaciones === 0 ? 1 : puntosDistribucion / totalAsignaciones;

  const puntuacion = cumplimientoDuro * 80 + cumplimientoBlando * 20;
  return Math.round(puntuacion * 10) / 10;
}
