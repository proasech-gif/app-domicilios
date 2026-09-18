import { createClient, getPerfilActual } from "@/lib/supabase/server";

async function contar(tabla: string) {
  const supabase = createClient();
  const { count } = await supabase.from(tabla).select("*", { count: "exact", head: true });
  return count ?? 0;
}

export default async function DashboardPage() {
  const perfil = await getPerfilActual();

  const [profesores, grupos, asignaturas, aulas, conflictos] = await Promise.all([
    contar("docentes"),
    contar("grupos"),
    contar("asignaturas"),
    contar("aulas"),
    contar("conflictos_horario"),
  ]);

  const tarjetas = [
    { etiqueta: "Profesores", valor: profesores },
    { etiqueta: "Grupos", valor: grupos },
    { etiqueta: "Asignaturas", valor: asignaturas },
    { etiqueta: "Aulas", valor: aulas },
    { etiqueta: "Conflictos activos", valor: conflictos },
  ];

  return (
    <div>
      <h1 className="mb-1 text-lg font-medium text-ink">
        Hola, {perfil?.nombre_completo?.split(" ")[0] ?? ""}
      </h1>
      <p className="mb-6 text-sm text-muted">
        Este es el estado actual de tu institución en HorarioEdu.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tarjetas.map((t) => (
          <div
            key={t.etiqueta}
            className="rounded-card border border-border bg-card p-4"
          >
            <p className="text-2xl font-medium text-ink">{t.valor}</p>
            <p className="mt-1 text-sm text-muted">{t.etiqueta}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
