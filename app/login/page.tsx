import { iniciarSesion } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; redirectTo?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-card bg-brand-600 text-white text-sm font-medium">
            HE
          </div>
          <h1 className="text-lg font-medium text-ink">HorarioEdu</h1>
          <p className="mt-1 text-sm text-muted">
            Ingresa con tu cuenta institucional
          </p>
        </div>

        <form
          action={iniciarSesion}
          className="rounded-card border border-border bg-card p-6 shadow-sm"
        >
          <input type="hidden" name="redirectTo" value={searchParams.redirectTo || "/dashboard"} />

          <label className="block text-sm text-ink mb-1" htmlFor="correo">
            Correo
          </label>
          <input
            id="correo"
            name="correo"
            type="email"
            required
            autoComplete="email"
            className="mb-4 w-full rounded-md border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
            placeholder="tu.correo@institucion.edu.co"
          />

          <label className="block text-sm text-ink mb-1" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mb-5 w-full rounded-md border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
            placeholder="••••••••"
          />

          {searchParams.error && (
            <p className="mb-4 rounded-md bg-accent-coral/10 px-3 py-2 text-sm text-accent-coral">
              {searchParams.error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Iniciar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
