import { google } from 'googleapis';
import { supabaseServer } from './supabaseServer';

/**
 * Conexión a Google Drive, separada del login del profesor.
 *
 * El profesor entra con el usuario/contraseña que tú le creaste en Supabase.
 * Ya adentro, si no ha conectado Drive todavía, ve un botón "Conectar Google
 * Drive" que lo manda por este flujo. A diferencia del login-con-Google de
 * Supabase (que solo entrega un access_token de corta duración), aquí pedimos
 * `access_type: offline` + `prompt: consent` para recibir un refresh_token,
 * lo guardamos en la tabla `google_tokens`, y desde ahí renovamos el
 * access_token nosotros mismos en cada llamada a Drive. El profesor nunca
 * tiene que volver a autorizar.
 *
 * Scope: `drive` completo (lectura/escritura de todo su Drive), no
 * `drive.file`. `drive.file` solo deja ver archivos creados o abiertos por
 * esta app — por eso el explorador antiguo no podía leer carpetas ya
 * existentes del profesor. Con `drive` completo, mientras el proyecto de
 * Google Cloud esté en modo "Prueba", solo entran las cuentas que agregues
 * como "usuarios de prueba"; para venderlo a más profesores hay que pasar la
 * verificación de Google (scopes sensibles como este la requieren).
 */

const SCOPES = ['https://www.googleapis.com/auth/drive'];

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/google/callback`
  );
}

export function urlDeAutorizacion(state: string) {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state
  });
}

export async function guardarTokenDesdeCodigo(profesorId: string, code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    // Pasa si el profesor ya había autorizado antes y Google no reenvía el
    // refresh_token (por eso siempre pedimos prompt: 'consent' arriba, que
    // fuerza a Google a entregarlo de nuevo cada vez).
    throw new Error('Google no devolvió un refresh_token. Vuelve a intentar la conexión.');
  }

  const supabase = supabaseServer();
  await supabase.from('google_tokens').upsert({
    profesor_id: profesorId,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope || null,
    updated_at: new Date().toISOString()
  });
}

// Devuelve un access_token fresco para el profesor, renovándolo con su
// refresh_token guardado. Se llama al inicio de cada endpoint que hable con
// Drive — así el profesor nunca ve un error de "sesión expirada".
export async function obtenerAccessToken(profesorId: string): Promise<string> {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from('google_tokens')
    .select('refresh_token')
    .eq('profesor_id', profesorId)
    .maybeSingle();

  if (!data?.refresh_token) {
    throw new Error('SIN_DRIVE_CONECTADO');
  }

  const client = oauthClient();
  client.setCredentials({ refresh_token: data.refresh_token });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) throw new Error('No se pudo renovar el acceso a Drive');
  return credentials.access_token;
}

export async function tieneDriveConectado(profesorId: string): Promise<boolean> {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from('google_tokens')
    .select('profesor_id')
    .eq('profesor_id', profesorId)
    .maybeSingle();
  return !!data;
}
