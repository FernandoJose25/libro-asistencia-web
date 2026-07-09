# Libro de Asistencia — Sitio web

App web (Next.js) para tomar asistencia por grupo, con los archivos viviendo en Google Drive
del profesor y un registro estructurado en Supabase para métricas y faltas acumuladas.

Este README asume que vas a llegar a producción con **GitHub Desktop + Vercel**, sin usar la
terminal más de lo estrictamente necesario.

## 0. Qué necesitas antes de empezar

1. Cuenta en [Supabase](https://supabase.com) (gratis).
2. Cuenta en [Vercel](https://vercel.com) (gratis, puedes entrar con tu cuenta de GitHub).
3. [GitHub Desktop](https://desktop.github.com/) instalado, y una cuenta de GitHub.
4. Cuenta en [Google Cloud Console](https://console.cloud.google.com) (gratis) para crear las
   credenciales OAuth que permiten leer/escribir en Drive.
5. [Node.js](https://nodejs.org) instalado en tu computadora (para probar el sitio en local antes
   de subirlo — descarga la versión LTS).

## 1. Crear el proyecto en Supabase

1. En Supabase, crea un proyecto nuevo (elige la región más cercana a tus usuarios).
proyecto12@  
2. Ve a **SQL Editor** → pega el contenido completo de `supabase/schema.sql` de este repo → Run.
   Esto crea las tablas, las políticas de seguridad (RLS) y la vista de horas de falta.
3. Ve a **Authentication → Providers → Google** y actívalo (lo configuras del todo en el paso 2).
4. Ve a **Project Settings → API** y copia:
   - `Project URL` → lo vas a usar como `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → lo vas a usar como `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Crear las credenciales de Google (para poder leer/escribir en Drive)

1. En Google Cloud Console, crea un proyecto nuevo (o usa uno existente).
2. Ve a **APIs y servicios → Biblioteca** → busca "Google Drive API" → **Habilitar**.
3. Ve a **APIs y servicios → Pantalla de consentimiento OAuth**:
   - Tipo de usuario: **Externo** (a menos que uses Google Workspace, entonces puede ser interno).
   - Completa el nombre de la app, correo de soporte, logo (opcional).
   - En "Scopes" agrega: `https://www.googleapis.com/auth/drive.file` (acceso solo a los
     archivos que la app abre — no a todo el Drive del profesor, es más seguro y más fácil de
     aprobar).
   - Mientras la app esté en modo "Prueba" (Testing), solo los correos que agregues como
     "usuarios de prueba" van a poder iniciar sesión. Para venderla a más profesores más adelante,
     hay que pasar por la verificación de Google (puede tardar); para tu primer cliente esto no es
     necesario todavía.
4. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - Orígenes autorizados de JavaScript: tu dominio de Vercel (ej. `https://tu-app.vercel.app`) y
     `http://localhost:3000` para pruebas locales.
   - URI de redirección autorizada: la que te da Supabase en Authentication → Providers → Google
     (algo como `https://xxxxx.supabase.co/auth/v1/callback`).
   - Copia el **Client ID** y el **Client Secret**.
5. Vuelve a Supabase → Authentication → Providers → Google → pega ahí el Client ID y Client
   Secret → Guardar.

## 3. Configurar el proyecto localmente

1. Descarga/clona este proyecto a tu computadora.
2. Copia `.env.example` a un archivo nuevo llamado `.env.local` y rellena los valores con los que
   copiaste de Supabase en el paso 1.
3. Abre una terminal en la carpeta del proyecto y corre:
   ```
   npm install
   npm run dev
   ```
4. Abre `http://localhost:3000` — deberías ver la pantalla de login. Prueba iniciar sesión con una
   cuenta que hayas agregado como "usuario de prueba" en Google Cloud (paso 2.3).

## 4. Subir el proyecto a GitHub con GitHub Desktop

1. Abre GitHub Desktop → **File → Add local repository** → selecciona la carpeta del proyecto.
2. Si te pregunta, dale "create a repository" (el `.gitignore` ya está incluido, así que
   `node_modules` y `.env.local` no se subirán).
3. Escribe un mensaje de commit (ej. "Primera versión del sitio") → **Commit to main**.
4. **Publish repository** → elige si lo quieres público o privado → Publish.

## 5. Desplegar en Vercel

1. Entra a Vercel con tu cuenta de GitHub → **Add New → Project**.
2. Selecciona el repositorio que acabas de publicar.
3. En "Environment Variables" agrega las mismas variables de tu `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` → aquí pon la URL que Vercel te va a asignar
     (ej. `https://tu-app.vercel.app`); si no la sabes todavía, despliega una vez, cópiala, y
     actualiza esta variable después (Vercel vuelve a desplegar solo).
4. **Deploy**. En unos minutos tienes la app en producción.
5. Vuelve a Google Cloud Console y agrega la URL final de Vercel en "Orígenes autorizados de
   JavaScript" (paso 2.4) si no lo habías hecho.

Cada vez que hagas cambios: edítalos localmente → **Commit** en GitHub Desktop → **Push origin** →
Vercel despliega automáticamente la nueva versión.

## 6. Cómo funciona la sincronización

- Los cambios de asistencia se guardan primero en el estado de la página (marcados como "sin
  guardar" en el indicador junto al botón de sincronizar).
- **Sincronizar ahora**: guarda en Supabase y reescribe el archivo de Drive con el estado actual.
- **Automática al reconectar**: si el navegador pierde conexión, el indicador cambia a "sin
  conexión"; en cuanto vuelve la señal a internet, la app sincroniza sola sin que el profesor
  tenga que hacer nada.
- No hay ninguna base de datos ni configuración que el profesor tenga que instalar: todo vive en
  Supabase (en la nube) y en su propio Drive.

## 7. Limitación conocida a tener en cuenta

El `provider_token` que Google le da a Supabase al iniciar sesión expira (normalmente ~1 hora) y
Supabase no lo renueva automáticamente para llamadas a APIs externas como Drive. Si un profesor
deja la pestaña abierta mucho tiempo sin interactuar, es posible que al sincronizar le pida volver
a iniciar sesión. Para una v1 con pocos profesores esto es aceptable; si más adelante se vuelve
molesto, la solución es capturar el `refresh_token` de Google (agregando `access_type: offline` ya
está en el código de login) y renovar el `access_token` desde un endpoint propio antes de cada
sincronización.

## 8. Estructura del proyecto

```
app/
  login/                    → pantalla de login con Google
  dashboard/
    page.tsx                → resumen (métricas + lista de grupos)
    import/                 → conectar carpeta de Drive
    grupo/[id]/              → captura de asistencia de un grupo (pestañas arriba)
  api/drive/
    list/                   → escanear carpeta (POST) y confirmar import (PUT)
    sync-file/[grupoId]/    → reescribe el archivo de Drive con la asistencia actual
components/                 → Sidebar, Topbar, pestañas de grupo, tabla de asistencia, etc.
lib/                        → clientes de Supabase, helpers de Google Drive, tipos
supabase/schema.sql         → esquema completo para pegar en el SQL Editor de Supabase
```
