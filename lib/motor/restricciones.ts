import { Asignacion, Aula, Clase, Franja, claveSlot } from "./tipos";

export function docenteOcupado(
  clases: Clase[],
  asignacionesPorId: Map<string, Asignacion>,
  docenteId: string,
  dia: number,
  franjaId: string,
  ignorarClaseId?: string
): boolean {
  return clases.some((c) => {
    if (c === (ignorarClaseId as unknown as Clase)) return false;
    if (c.dia_semana !== dia || c.franja_id !== franjaId) return false;
    const asig = asignacionesPorId.get(c.asignacion_id);
    return asig?.docente_id === docenteId;
  });
}

export function grupoOcupado(
  clases: Clase[],
  asignacionesPorId: Map<string, Asignacion>,
  grupoId: string,
  dia: number,
  franjaId: string
): boolean {
  return clases.some((c) => {
    if (c.dia_semana !== dia || c.franja_id !== franjaId) return false;
    const asig = asignacionesPorId.get(c.asignacion_id);
    return asig?.grupo_id === grupoId;
  });
}

export function aulaOcupada(clases: Clase[], aulaId: string, dia: number, franjaId: string): boolean {
  return clases.some((c) => c.aula_id === aulaId && c.dia_semana === dia && c.franja_id === franjaId);
}

export function docenteDisponible(
  disponibilidad: Map<string, Set<string>>,
  docenteId: string,
  dia: number,
  franjaId: string
): boolean {
  const set = disponibilidad.get(docenteId);
  // Si el docente no tiene ninguna fila de disponibilidad registrada, se asume
  // disponible (para no bloquear instituciones que aún no han cargado ese dato).
  if (!set || set.size === 0) return true;
  return set.has(claveSlot(dia, franjaId));
}

export function aulaCompatible(aula: Aula, tipoRequerido: string | null | undefined): boolean {
  if (!aula.activa) return false;
  if (!tipoRequerido) return true;
  return aula.tipo === tipoRequerido;
}

export function franjaEsDeClase(franja: Franja): boolean {
  return franja.es_bloque_clase;
}
