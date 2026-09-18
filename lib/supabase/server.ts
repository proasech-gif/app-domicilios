import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Se ignora cuando se llama desde un Server Component sin
            // capacidad de escritura; el middleware refresca la sesión igual.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Igual que arriba.
          }
        },
      },
    }
  );
}

/**
 * Obtiene el perfil (rol + institución) del usuario autenticado actual.
 * Devuelve null si no hay sesión o no existe fila en `perfiles` todavía.
 */
export async function getPerfilActual() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, rol, institucion_id, nombre_completo, correo, activo")
    .eq("id", user.id)
    .single();

  return perfil;
}
