import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/supabase/server";

export default async function Home() {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login");
  if (perfil.rol === "docente") redirect("/sin-acceso");
  redirect("/dashboard");
}
