export type ErrorFila = { fila: number; mensaje: string };

const TIPOS_AULA_VALIDOS = [
  "normal",
  "laboratorio",
  "informatica",
  "ingles",
  "educacion_fisica",
  "auditorio",
  "especializada",
];
const JORNADAS_VALIDAS = ["manana", "tarde", "unica", "completa"];

function celda(fila: Record<string, any>, ...nombres: string[]): string {
  for (const n of nombres) {
    for (const clave of Object.keys(fila)) {
      if (clave.trim().toLowerCase() === n.toLowerCase()) {
        const v = fila[clave];
        return v === undefined || v === null ? "" : String(v).trim();
      }
    }
  }
  return "";
}

export function validarAulas(filas: Record<string, any>[]) {
  const errores: ErrorFila[] = [];
  const validas: { nombre: string; tipo: string; capacidad: number | null; sede: string | null }[] = [];

  filas.forEach((fila, i) => {
    const n = i + 2; // fila 1 es el encabezado
    const nombre = celda(fila, "nombre");
    const tipoRaw = celda(fila, "tipo") || "normal";
    const tipo = tipoRaw.toLowerCase().replace(/\s+/g, "_");
    const capacidadRaw = celda(fila, "capacidad");
    const sede = celda(fila, "sede") || null;

    if (!nombre) {
      errores.push({ fila: n, mensaje: "Falta el nombre del aula." });
      return;
    }
    if (!TIPOS_AULA_VALIDOS.includes(tipo)) {
      errores.push({
        fila: n,
        mensaje: `Tipo de aula "${tipoRaw}" no es válido. Usa: ${TIPOS_AULA_VALIDOS.join(", ")}.`,
      });
      return;
    }
    let capacidad: number | null = null;
    if (capacidadRaw) {
      capacidad = Number(capacidadRaw);
      if (Number.isNaN(capacidad) || capacidad <= 0) {
        errores.push({ fila: n, mensaje: `Capacidad "${capacidadRaw}" no es un número válido.` });
        return;
      }
    }

    validas.push({ nombre, tipo, capacidad, sede });
  });

  return { errores, validas };
}

export function validarAsignaturas(filas: Record<string, any>[], areasValidas: { id: string; nombre: string }[]) {
  const errores: ErrorFila[] = [];
  const validas: { nombre: string; area_id: string; intensidad_horaria_semanal: number | null }[] = [];
  const areaPorNombre = new Map(areasValidas.map((a) => [a.nombre.toLowerCase(), a.id]));

  filas.forEach((fila, i) => {
    const n = i + 2;
    const nombre = celda(fila, "nombre");
    const areaNombre = celda(fila, "area", "área");
    const intensidadRaw = celda(fila, "intensidad_horaria_semanal", "intensidad", "horas");

    if (!nombre) {
      errores.push({ fila: n, mensaje: "Falta el nombre de la asignatura." });
      return;
    }
    if (!areaNombre) {
      errores.push({ fila: n, mensaje: "Falta el área." });
      return;
    }
    const areaId = areaPorNombre.get(areaNombre.toLowerCase());
    if (!areaId) {
      errores.push({ fila: n, mensaje: `El área "${areaNombre}" no existe en tu institución.` });
      return;
    }
    let intensidad: number | null = null;
    if (intensidadRaw) {
      intensidad = Number(intensidadRaw);
      if (Number.isNaN(intensidad) || intensidad <= 0) {
        errores.push({ fila: n, mensaje: `Intensidad horaria "${intensidadRaw}" no es válida.` });
        return;
      }
    }

    validas.push({ nombre, area_id: areaId, intensidad_horaria_semanal: intensidad });
  });

  return { errores, validas };
}

export function validarGrupos(filas: Record<string, any>[], gradosValidos: { id: string; nombre: string }[]) {
  const errores: ErrorFila[] = [];
  const validas: {
    grado_id: string;
    nombre: string;
    codigo_grupo: string;
    jornada: string | null;
    anio_lectivo: number;
  }[] = [];
  const gradoPorNombre = new Map(gradosValidos.map((g) => [g.nombre.toLowerCase(), g.id]));
  const codigosEnArchivo = new Set<string>();

  filas.forEach((fila, i) => {
    const n = i + 2;
    const gradoNombre = celda(fila, "grado");
    const nombre = celda(fila, "nombre", "grupo");
    const codigo = celda(fila, "codigo_grupo", "codigo", "código");
    const jornadaRaw = celda(fila, "jornada").toLowerCase();
    const anioRaw = celda(fila, "anio_lectivo", "año_lectivo", "año");

    if (!gradoNombre) {
      errores.push({ fila: n, mensaje: "Falta el grado." });
      return;
    }
    const gradoId = gradoPorNombre.get(gradoNombre.toLowerCase());
    if (!gradoId) {
      errores.push({ fila: n, mensaje: `El grado "${gradoNombre}" no existe en tu institución.` });
      return;
    }
    if (!nombre) {
      errores.push({ fila: n, mensaje: "Falta el nombre del grupo." });
      return;
    }
    if (!codigo) {
      errores.push({ fila: n, mensaje: "Falta el código de grupo (debe ser único)." });
      return;
    }
    if (codigosEnArchivo.has(codigo.toLowerCase())) {
      errores.push({ fila: n, mensaje: `Código de grupo "${codigo}" duplicado dentro del mismo archivo.` });
      return;
    }
    if (jornadaRaw && !JORNADAS_VALIDAS.includes(jornadaRaw)) {
      errores.push({
        fila: n,
        mensaje: `Jornada "${jornadaRaw}" no es válida. Usa: ${JORNADAS_VALIDAS.join(", ")}.`,
      });
      return;
    }
    const anio = anioRaw ? Number(anioRaw) : new Date().getFullYear();
    if (Number.isNaN(anio)) {
      errores.push({ fila: n, mensaje: `Año lectivo "${anioRaw}" no es válido.` });
      return;
    }

    codigosEnArchivo.add(codigo.toLowerCase());
    validas.push({
      grado_id: gradoId,
      nombre,
      codigo_grupo: codigo,
      jornada: jornadaRaw || null,
      anio_lectivo: anio,
    });
  });

  return { errores, validas };
}

export function validarDisponibilidad(
  filas: Record<string, any>[],
  docentesValidos: { perfil_id: string; nombre_completo: string }[],
  franjasValidas: { id: string; nombre: string }[]
) {
  const errores: ErrorFila[] = [];
  const validas: { docente_id: string; dia_semana: number; franja_id: string; disponible: boolean }[] = [];
  const docentePorNombre = new Map(docentesValidos.map((d) => [d.nombre_completo.toLowerCase(), d.perfil_id]));
  const franjaPorNombre = new Map(franjasValidas.map((f) => [f.nombre.toLowerCase(), f.id]));
  const DIAS_NOMBRE: Record<string, number> = {
    lunes: 1,
    martes: 2,
    miercoles: 3,
    miércoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
    sábado: 6,
  };

  filas.forEach((fila, i) => {
    const n = i + 2;
    const docenteNombre = celda(fila, "docente", "profesor");
    const diaRaw = celda(fila, "dia_semana", "día", "dia").toLowerCase();
    const franjaNombre = celda(fila, "franja", "bloque", "hora");
    const disponibleRaw = celda(fila, "disponible").toLowerCase();

    if (!docenteNombre) {
      errores.push({ fila: n, mensaje: "Falta el nombre del docente." });
      return;
    }
    const docenteId = docentePorNombre.get(docenteNombre.toLowerCase());
    if (!docenteId) {
      errores.push({ fila: n, mensaje: `El docente "${docenteNombre}" no existe en tu institución.` });
      return;
    }
    let dia: number | undefined = DIAS_NOMBRE[diaRaw];
    if (dia === undefined && /^[1-6]$/.test(diaRaw)) dia = Number(diaRaw);
    if (!dia) {
      errores.push({ fila: n, mensaje: `Día "${diaRaw}" no es válido (usa lunes-sábado o 1-6).` });
      return;
    }
    if (!franjaNombre) {
      errores.push({ fila: n, mensaje: "Falta la franja horaria." });
      return;
    }
    const franjaId = franjaPorNombre.get(franjaNombre.toLowerCase());
    if (!franjaId) {
      errores.push({ fila: n, mensaje: `La franja "${franjaNombre}" no existe en tu institución.` });
      return;
    }
    if (!["si", "sí", "no", "true", "false", "1", "0"].includes(disponibleRaw)) {
      errores.push({ fila: n, mensaje: `Valor "${disponibleRaw}" en Disponible debe ser SI o NO.` });
      return;
    }
    const disponible = ["si", "sí", "true", "1"].includes(disponibleRaw);

    validas.push({ docente_id: docenteId, dia_semana: dia, franja_id: franjaId, disponible });
  });

  return { errores, validas };
}
