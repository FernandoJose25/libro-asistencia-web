# Libro de Asistencia — Sitio web

App web (Next.js) para tomar asistencia por grupo. Los archivos viven en el Google Drive
real del profesor (todo tipo de archivo, no solo hojas de asistencia) y hay un registro
estructurado en Supabase para métricas y faltas acumuladas.

Este README asume que vas a llegar a producción con **GitHub Desktop + Vercel**, sin usar la
terminal más de lo estrictamente necesario.

## Cómo cambió el modelo (léelo antes de configurar)

- **Tú creas cada cuenta de profesor**, no hay pantalla de registro. Se hace en Supabase →
  Authentication → Users → **Add user** (email + contraseña) y le compartes esas
  credenciales al profesor.
- **Conectar Google Drive es un paso aparte**, después de entrar a la app. La primera vez
  que un profesor entra, si no ha conectado Drive todavía, ve una pantalla con un botón
  "Conectar Google Drive". Autoriza una sola vez — la app guarda su `refresh_token` y
  renueva el acceso ella sola para siempre. No hay que volver a autorizar nunca.
- **El explorador de Drive es completo**, como el Drive real: carpetas, fotos, Word, Excel,
  PDF, todo — navegable, no hay que "importar una carpeta" antes. Cualquier hoja de cálculo
  (xlsx, csv o Google Sheet) tiene un botón "Usar para asistencia" que la convierte en un
  grupo con su editor de asistencia.
- Para archivos que no son de asistencia (Word, PDF, imágenes, etc.), el botón "Abrir y
  editar en Google Drive" abre el propio editor de Google en una pestaña nueva — sigue
  siendo tu Drive, nada se duplica. Construir un editor de Word/PDF/imágenes propio desde
  cero es un proyecto aparte, no algo que viva dentro de esta app.

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
2. Ve a **SQL Editor** → pega el contenido completo de `supabase/schema.sql` de este repo → Run.
   Esto crea las tablas, las políticas de seguridad (RLS) y la vista de horas de falta.
3. Ve a **Project Settings → API** y copia:
   - `Project URL` → lo vas a usar como `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → lo vas a usar como `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Ve a **Authentication → Users → Add user** y crea ahí la cuenta de cada profesor (email +
   contraseña). Esa es la cuenta que le compartes; no hay registro propio en la app.

## 2. Crear las credenciales de Google (para poder leer/escribir en Drive)

1. En Google Cloud Console, crea un proyecto nuevo (o usa uno existente).
2. Ve a **APIs y servicios → Biblioteca** → busca "Google Drive API" → **Habilitar**.
3. Ve a **APIs y servicios → Pantalla de consentimiento OAuth**:
   - Tipo de usuario: **Externo** (a menos que uses Google Workspace, entonces puede ser interno).
   - Completa el nombre de la app, correo de soporte, logo (opcional).
   - En "Scopes" agrega: `https://www.googleapis.com/auth/drive` (acceso completo de
     lectura/escritura al Drive del profesor — se necesita para poder navegar carpetas que
     ya existían antes de usar la app, no solo archivos creados por ella).
   - Mientras la app esté en modo "Prueba" (Testing), solo los correos que agregues como
     "usuarios de prueba" van a poder conectar Drive. Para venderla a más profesores más
     adelante, hay que pasar por la verificación de Google — este scope es "sensible" y la
     revisión puede tardar unos días; para tus primeros profesores esto no es necesario
     todavía, basta con agregarlos como usuarios de prueba.
4. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - Orígenes autorizados de JavaScript: tu dominio de Vercel (ej. `https://tu-app.vercel.app`) y
     `http://localhost:3000` para pruebas locales.
   - URI de redirección autorizada:
     `https://tu-app.vercel.app/api/google/callback` (y `http://localhost:3000/api/google/callback`
     para pruebas locales). **Ya no se usa la URL de callback de Supabase** — el login del
     profesor ahora es con email/contraseña, y conectar Drive lo maneja esta app directamente.
   - Copia el **Client ID** y el **Client Secret**.

## 3. Configurar el proyecto localmente

1. Descarga/clona este proyecto a tu computadora.
2. Copia `.env.example` a un archivo nuevo llamado `.env.local` y rellena:
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (paso 1).
   - `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (paso 2).
   - `NEXT_PUBLIC_SITE_URL=http://localhost:3000` para pruebas locales.
3. Abre una terminal en la carpeta del proyecto y corre:
   ```
   npm install
   npm run dev
   ```
4. Abre `http://localhost:3000` — deberías ver la pantalla de login. Entra con una cuenta que
   hayas creado en Supabase (paso 1.4), y luego conecta Drive con una cuenta de Google que
   hayas agregado como "usuario de prueba" en Google Cloud (paso 2.3).

## 4. Subir el proyecto a GitHub con GitHub Desktop

1. Abre GitHub Desktop → **File → Add local repository** → selecciona la carpeta del proyecto.
2. Si te pregunta, dale "create a repository" (el `.gitignore` ya está incluido, así que
   `node_modules` y `.env.local` no se subirán).
3. Escribe un mensaje de commit → **Commit to main**.
4. **Publish repository** (o **Push origin** si ya existía) → Publish.

## 5. Desplegar en Vercel

1. Entra a Vercel con tu cuenta de GitHub → **Add New → Project** (o usa el proyecto que ya
   tenías, solo haz **Push** desde GitHub Desktop y Vercel despliega solo).
2. En "Environment Variables" agrega las mismas variables de tu `.env.local`, con
   `NEXT_PUBLIC_SITE_URL` apuntando a tu URL final de Vercel.
3. **Deploy**. En unos minutos tienes la app en producción.
4. Vuelve a Google Cloud Console y agrega la URL final de Vercel en "Orígenes autorizados de
   JavaScript" y la URI de redirección `https://tu-app.vercel.app/api/google/callback` (paso 2.4)
   si no lo habías hecho.

Cada vez que hagas cambios: edítalos localmente → **Commit** en GitHub Desktop → **Push origin** →
Vercel despliega automáticamente la nueva versión.

## 6. Cómo funciona ahora

- **Login**: email + contraseña que tú creaste en Supabase. Sin registro propio.
- **Conectar Drive**: paso único después del primer login; guarda el `refresh_token` en una
  tabla protegida con RLS (cada profesor solo puede leer/escribir su propia fila) y la app lo
  usa para renovar el `access_token` antes de cada llamada a Drive. El profesor nunca ve un
  error de "sesión expirada".
- **Explorador de Drive** (`/dashboard/drive`): navega carpetas y archivos de cualquier tipo,
  con búsqueda, subir archivo, crear carpeta, renombrar, mover, guardar una copia, eliminar
  (papelera) y descargar/guardar localmente.
- **Asistencia**: desde el explorador, cualquier hoja de cálculo tiene "Usar para asistencia" →
  crea el grupo, importa los alumnos (primera columna) y abre el editor con los botones de
  Asistió/Tardanza/Faltó, horas por día, exportar a Excel/PDF (se descargan a tu computadora)
  y "Sincronizar ahora" (guarda en Supabase y reescribe el archivo de Drive).
- **Archivos que no son de asistencia** (Word, PDF, imágenes, etc.): se abren y editan con el
  propio editor de Google Drive en una pestaña nueva; seguirá siendo tu archivo, nada se
  duplica.

## 7. Estructura del proyecto

```
app/
  login/                        → login con email/contraseña
  dashboard/
    page.tsx                    → resumen (métricas + lista de grupos)
    conectar-drive/              → pantalla de "Conectar Google Drive" (una sola vez)
    drive/                       → explorador completo de Drive
    grupo/[id]/                  → captura de asistencia de un grupo
  api/
    google/connect, google/callback   → flujo de conexión de Drive (guarda refresh_token)
    drive/browse, search, upload, rename, move, copy, delete,
        create-folder, download, create-attendance, sync-file/[grupoId]
components/                      → Sidebar, Topbar, DriveExplorer, tabla de asistencia, etc.
lib/
  googleAuth.ts                  → genera la URL de consentimiento y renueva el access_token
  driveContext.ts                → helper compartido: sesión + access_token para cada endpoint
  drive.ts                       → todas las operaciones sobre Drive (listar, subir, mover, etc.)
supabase/schema.sql               → esquema completo para pegar en el SQL Editor de Supabase
```

## 8. Limitación conocida a tener en cuenta

Un editor propio de Word/PDF/imágenes (como el de Google Docs u Office) dentro de la app es
un proyecto en sí mismo — no es algo que viva en esta v1. Lo que sí tienes: vista del archivo
+ "Abrir y editar en Google Drive" (el editor real de Google) para todo lo que no sea una hoja
de asistencia, y el editor propio con guardado automático específicamente para asistencia, que
es donde tiene sentido tener una interfaz a medida.
