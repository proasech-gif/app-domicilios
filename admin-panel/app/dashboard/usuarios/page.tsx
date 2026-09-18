"use client";

import { useEffect, useState } from "react";
import { api, AdminUser } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  cliente: "Cliente",
  comercio: "Comercio",
  domiciliario: "Domiciliario",
  admin: "Admin",
};

export default function UsuariosPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setUsers(await api.listUsers(roleFilter || undefined));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  async function toggle(user: AdminUser) {
    setBusyId(user.id);
    try {
      if (user.is_active) await api.suspendUser(user.id);
      else await api.reactivateUser(user.id);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Usuarios</h1>
          <p className="text-sm text-slate-500">Suspende o reactiva cualquier cuenta de la plataforma.</p>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-300 text-sm px-3 py-2"
        >
          <option value="">Todos los roles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Correo</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{u.full_name}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3">{ROLE_LABELS[u.role] || u.role}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {u.is_active ? "Activo" : "Suspendido"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    disabled={busyId === u.id || u.role === "admin"}
                    onClick={() => toggle(u)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
                  >
                    {u.is_active ? "Suspender" : "Reactivar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && users.length === 0 && (
          <p className="text-sm text-slate-500 px-4 py-6 text-center">No hay usuarios con ese filtro.</p>
        )}
      </div>
    </div>
  );
}
