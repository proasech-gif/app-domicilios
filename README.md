# HorarioEdu — Fase D (Autenticación y permisos)

Este es el scaffolding real de Next.js + Supabase Auth para el proyecto
`preicfes2020pp-ops's Project` (ref `hmazqbwqodbiyburvczn`). No usa datos
simulados: el login, el dashboard y la protección de rutas hablan
directamente con tu Supabase real, respetando las políticas RLS que ya
configuramos en las Fases B y C.

## 1. Instalar dependencias

```bash
npm install
```

## 2. Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

El archivo de ejemplo ya trae la URL y la clave `anon` de tu proyecto
(`hmazqbwqodbiyburvczn`). Esa clave es segura para el frontend: el acceso
real está controlado por las políticas RLS de Supabase, no por esta clave.
**Nunca** agregues aquí la `service_role key`.

## 3. Ejecutar en desarrollo

```bash
npm run dev
```

Abre http://localhost:3000

## 4. Cómo probar la autenticación y los roles

Ya existen 3 usuarios de prueba en la base de datos (perfiles `docente`,
`rector`, `superadmin`), pero **no tienen contraseña asignada todavía**
porque `auth.users` y `perfiles` son tablas separadas por diseño de
Supabase Auth. Para poder iniciar sesión con ellos:

1. Ve al dashboard de Supabase → Authentication → Users.
2. Verifica si esos usuarios ya existen en `auth.users` (deberían, ya que
   `perfiles.id` referencia `auth.users.id`).
3. Si necesitas una contraseña de prueba, usa el botón "Send magic link"
   o "Reset password" desde ese panel — no se puede fijar una contraseña
   directamente por SQL, es una decisión de seguridad de Supabase.

Alternativa más simple para probar ya mismo: crea un usuario nuevo desde
`/login` una vez agreguemos la página de registro (Fase E), o créalo
manualmente desde Authentication → Users → "Add user" en el dashboard de
Supabase, y luego crea su fila correspondiente en `perfiles` con el mismo
`id` y el `rol` que quieras probar.

## 5. Qué queda protegido

El archivo `middleware.ts` protege estas rutas por rol (ver tabla
`REGLAS_DE_ACCESO`): si un docente intenta entrar a `/profesores` o
`/generador`, es redirigido a `/dashboard` con un aviso. Todas las rutas
requieren sesión activa excepto `/login`.

Las páginas de cada módulo (`/profesores`, `/asignaturas`, `/aulas`, etc.)
todavía no existen — son la Fase E (CRUD). Este scaffolding cubre
únicamente autenticación, sesión, perfil y navegación por rol.

## Riesgos / cosas a revisar

- El middleware hace una consulta a `perfiles` en cada navegación a una
  ruta protegida por rol. Es aceptable para el tamaño actual de datos,
  pero si la institución crece mucho, conviene cachear el rol en el JWT
  (custom claims de Supabase Auth) en vez de consultarlo cada vez.
- No se tocó ninguna tabla ni dato de Supabase en esta fase — es código
  de aplicación puro.
