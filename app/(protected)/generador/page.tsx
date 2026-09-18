import { GeneradorHorario } from "./generador-horario";

export default function GeneradorPage() {
  return (
    <div>
      <h1 className="mb-1 text-lg font-medium text-ink">Generador de horarios</h1>
      <p className="mb-6 text-sm text-muted">
        Genera automáticamente una nueva versión del horario respetando disponibilidad,
        intensidad horaria y aulas.
      </p>

      <GeneradorHorario />
    </div>
  );
}
