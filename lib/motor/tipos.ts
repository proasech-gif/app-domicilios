export type Asignacion = {
  id: string;
  docente_id: string;
  grupo_id: string;
  asignatura_id: string;
  area_id: string;
  horas_semanales: number;
};

export type Franja = {
  id: string;
  orden: number;
  es_bloque_clase: boolean;
};

export type Aula = {
  id: string;
  tipo: string;
  activa: boolean;
};

export type Asignatura = {
  id: string;
  nombre: string;
  aula_tipo_requerido?: string | null;
};

/** slot = combinación única de día (1-6) y franja */
export type Slot = { dia: number; franja_id: string };

export type Clase = {
  asignacion_id: string;
  dia_semana: number;
  franja_id: string;
  aula_id: string | null;
};

export type EntradaMotor = {
  asignaciones: Asignacion[];
  disponibilidad: Map<string, Set<string>>; // docente_id -> set de "dia-franja_id"
  franjas: Franja[];
  dias: number[]; // ej. [1,2,3,4,5]
  aulas: Aula[];
  asignaturasPorId: Map<string, Asignatura>;
};

export type ResultadoMotor = {
  clases: Clase[];
  conflictos: ConflictoDetectado[];
  puntuacion: number;
};

export type ConflictoDetectado = {
  tipo: string;
  severidad: "critico" | "advertencia";
  descripcion: string;
  entidad_afectada: Record<string, unknown>;
};

export function claveSlot(dia: number, franjaId: string) {
  return `${dia}-${franjaId}`;
}
