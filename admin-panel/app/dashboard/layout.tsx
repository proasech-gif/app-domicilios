"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isAuthenticated, clearToken } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/dashboard/restaurantes", label: "Comercios" },
  { href: "/dashboard/domiciliarios", label: "Domiciliarios" },
  { href: "/dashboard/pedidos", label: "Pedidos" },
  { href: "/dashboard/retiros", label: "Retiros" },
  { href: "/dashboard/usuarios", label: "Usuarios" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) return null;

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-slate-900 text-slate-200 flex flex-col">
        <div className="px-5 py-5 text-lg font-semibold text-white border-b border-slate-800">
          Domicilios · Admin
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-lg text-sm transition ${
                  active ? "bg-brand text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={handleLogout}
          className="m-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 text-left"
        >
          Cerrar sesión
        </button>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
