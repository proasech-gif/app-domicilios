import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Mapa de prefijos de ruta -> roles autorizados.
 * Si una ruta protegida no aparece aquí, se asume "cualquier usuario autenticado".
 */
const REGLAS_DE_ACCESO: { prefix: string; roles: string[] }[] = [
  { prefix: "/configuracion", roles: ["superadmin"] },
  { prefix: "/admin", roles: ["superadmin"] },
  { prefix: "/instituciones", roles: ["superadmin"] },
  { prefix: "/auditoria", roles: ["rector", "superadmin"] },
  { prefix: "/profesores", roles: ["coordinador", "rector", "superadmin"] },
  { prefix: "/asignaturas", roles: ["coordinador", "rector", "superadmin"] },
  { prefix: "/grupos", roles: ["coordinador", "rector", "superadmin"] },
  { prefix: "/aulas", roles: ["coordinador", "rector", "superadmin"] },
  { prefix: "/disponibilidad", roles: ["coordinador", "rector", "superadmin"] },
  { prefix: "/generador", roles: ["coordinador", "superadmin"] },
  { prefix: "/conflictos", roles: ["coordinador", "rector", "superadmin"] },
  { prefix: "/horarios-emergentes", roles: ["coordinador", "rector", "superadmin"] },
  { prefix: "/importar-excel", roles: ["coordinador", "superadmin"] },
  { prefix: "/versiones", roles: ["coordinador", "rector", "superadmin"] },
];

const RUTAS_PUBLICAS = ["/login", "/auth/callback"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Refresca la sesión si el token expiró (necesario en Server Components).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esRutaPublica = RUTAS_PUBLICAS.some((r) => pathname.startsWith(r));

  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // HorarioEdu es solo para Rector, Coordinador académico y Administrador.
  // El rol "docente" existe en esta base de datos para otros módulos de la
  // plataforma (ICFES, planes de clase, asistencia), pero no tiene acceso
  // a este módulo en absoluto.
  if (user && !esRutaPublica && pathname !== "/sin-acceso") {
    const { data: perfilRol } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (perfilRol?.rol === "docente") {
      const url = request.nextUrl.clone();
      url.pathname = "/sin-acceso";
      return NextResponse.redirect(url);
    }
  }

  // Gating por rol: solo se consulta `perfiles` si la ruta actual lo exige.
  const regla = REGLAS_DE_ACCESO.find((r) => pathname.startsWith(r.prefix));
  if (user && regla) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (!perfil || !regla.roles.includes(perfil.rol)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.searchParams.set("sinPermiso", pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto archivos estáticos y de Next.js internos.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
