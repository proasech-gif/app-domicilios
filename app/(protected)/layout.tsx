import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/supabase/server";
import { cerrarSesion } from "../login/actions";
import { Sidebar } from "./sidebar";

const ETIQUETA_ROL: Record<string, string> = {
  docente: "Docente",
  rector: "Rector",
  coordinador: "Coordinador académico",
  superadmin: "Administrador",
};

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfilActual();

  if (!perfil) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar rol={perfil.rol} />

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <div>
            <p className="text-sm font-medium text-ink">{perfil.nombre_completo}</p>
            <p className="text-xs text-muted">{ETIQUETA_ROL[perfil.rol] ?? perfil.rol}</p>
          </div>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted transition hover:border-brand-400 hover:text-brand-600"
            >
              Cerrar sesión
            </button>
          </form>
        </header>

        <main className="flex-1 bg-surface p-6">{children}</main>
      </div>
    </div>
  );
}
