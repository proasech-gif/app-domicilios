"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ItemMenu = {
  href: string;
  etiqueta: string;
  roles: string[];
};

// HorarioEdu es exclusivamente para Rector, Coordinador académico y
// Administrador (Fase 4 del proyecto). El rol "docente" existe en esta
// base de datos para otros módulos de la plataforma (ICFES, planes de
// clase, asistencia), pero no tiene acceso a este módulo.
const ITEMS: ItemMenu[] = [
  { href: "/dashboard", etiqueta: "Dashboard", roles: ["rector", "coordinador", "superadmin"] },
  { href: "/instituciones", etiqueta: "Institución", roles: ["superadmin"] },
  { href: "/profesores", etiqueta: "Profesores", roles: ["coordinador", "rector", "superadmin"] },
  { href: "/asignaturas", etiqueta: "Asignaturas", roles: ["coordinador", "rector", "superadmin"] },
  { href: "/grupos", etiqueta: "Grupos", roles: ["coordinador", "rector", "superadmin"] },
  { href: "/aulas", etiqueta: "Aulas", roles: ["coordinador", "rector", "superadmin"] },
  { href: "/disponibilidad", etiqueta: "Disponibilidad", roles: ["coordinador", "rector", "superadmin"] },
  { href: "/generador", etiqueta: "Generador de horarios", roles: ["coordinador", "superadmin"] },
  { href: "/horarios", etiqueta: "Horarios", roles: ["rector", "coordinador", "superadmin"] },
  { href: "/horarios-emergentes", etiqueta: "Horarios emergentes", roles: ["rector", "coordinador", "superadmin"] },
  { href: "/conflictos", etiqueta: "Conflictos", roles: ["coordinador", "rector", "superadmin"] },
  { href: "/importar-excel", etiqueta: "Importar Excel", roles: ["coordinador", "superadmin"] },
  { href: "/versiones", etiqueta: "Versiones", roles: ["coordinador", "rector", "superadmin"] },
  { href: "/auditoria", etiqueta: "Auditoría", roles: ["rector", "superadmin"] },
  { href: "/configuracion", etiqueta: "Configuración", roles: ["superadmin"] },
];

export function Sidebar({ rol }: { rol: string }) {
  const pathname = usePathname();
  const visibles = ITEMS.filter((item) => item.roles.includes(rol));

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card px-3 py-5">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-card bg-brand-600 text-xs font-medium text-white">
          HE
        </div>
        <span className="text-sm font-medium text-ink">HorarioEdu</span>
      </div>

      <ul className="flex flex-col gap-0.5">
        {visibles.map((item) => {
          const activo = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm transition ${
                  activo
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-muted hover:bg-surface hover:text-ink"
                }`}
              >
                {item.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
