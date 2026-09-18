import { cerrarSesion } from "@/app/login/actions";

export default function SinAccesoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-card border border-border bg-card p-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-card bg-brand-600 text-white text-sm font-medium">
          HE
        </div>
        <h1 className="mb-2 text-lg font-medium text-ink">
          Este módulo no está disponible para tu rol
        </h1>
        <p className="mb-5 text-sm text-muted">
          HorarioEdu es de uso exclusivo para rectores, coordinadores
          académicos y administradores. Tu cuenta de docente conserva
          acceso al resto de la plataforma.
        </p>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="w-full rounded-md border border-border px-3 py-2 text-sm text-muted transition hover:border-brand-400 hover:text-brand-600"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
