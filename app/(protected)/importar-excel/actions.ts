"use server";

import { revalidatePath } from "next/cache";
import { createClient, getPerfilActual } from "@/lib/supabase/server";

export async function importarAulas(
  filas: { nombre: string; tipo: string; capacidad: number | null; sede: string | null }[]
) {
  const perfil = await getPerfilActual();
  if (!perfil?.institucion_id) return { error: "No se encontró tu institución." };

  const supabase = createClient();
  const { error } = await supabase.from("aulas").insert(
    filas.map((f) => ({ ...f, institucion_id: perfil.institucion_id }))
  );

  if (error) return { error: error.message };
  revalidatePath("/aulas");
  return { error: null, total: filas.length };
}

export async function importarAsignaturas(
  filas: { nombre: string; area_id: string; intensidad_horaria_semanal: number | null }[]
) {
  const supabase = createClient();
  const { error } = await supabase.from("asignaturas").insert(filas);
  if (error) return { error: error.message };
  revalidatePath("/asignaturas");
  return { error: null, total: filas.length };
}

export async function importarGrupos(
  filas: {
    grado_id: string;
    nombre: string;
    codigo_grupo: string;
    jornada: string | null;
    anio_lectivo: number;
  }[]
) {
  const perfil = await getPerfilActual();
  if (!perfil?.institucion_id) return { error: "No se encontró tu institución." };

  const supabase = createClient();
  const { error } = await supabase.from("grupos").insert(
    filas.map((f) => ({ ...f, institucion_id: perfil.institucion_id }))
  );

  if (error) {
    if (error.code === "23505") {
      return { error: "Uno de los códigos de grupo ya existe en la base de datos." };
    }
    return { error: error.message };
  }
  revalidatePath("/grupos");
  return { error: null, total: filas.length };
}

export async function importarDisponibilidad(
  filas: { docente_id: string; dia_semana: number; franja_id: string; disponible: boolean }[]
) {
  const supabase = createClient();

  // upsert para permitir reimportar sin duplicar (coincide con el índice único
  // docente_id + dia_semana + franja_id definido en la Fase B).
  const { error } = await supabase
    .from("disponibilidad_docentes")
    .upsert(filas, { onConflict: "docente_id,dia_semana,franja_id" });

  if (error) return { error: error.message };
  revalidatePath("/disponibilidad");
  return { error: null, total: filas.length };
}
