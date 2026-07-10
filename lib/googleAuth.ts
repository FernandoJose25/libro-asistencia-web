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
    // 'consent' fuerza a que siempre entregue un refresh_token nuevo.
    // 'select_account' fuerza el selector de cuentas de Google, para que un
    // profesor pueda desconectar y volver a conectar con una cuenta de
    // Drive distinta sin que Google lo autologuee con la misma de antes.
    prompt: 'consent select_account',
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
  const { error } = await supabase.from('google_tokens').upsert({
    profesor_id: profesorId,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope || null,
    updated_at: new Date().toISOString()
  });

  if (error) {
    // Antes esto se ignoraba en silencio: si la base de datos rechazaba el
    // guardado (ej. por una política de seguridad RLS), el flujo seguía
    // como si hubiera funcionado y el profesor terminaba en un loop
    // infinito viendo "Conecta tu Google Drive" una y otra vez, sin ningún
    // mensaje. Ahora se propaga el error real para poder verlo y arreglarlo.
    throw new Error(`No se pudo guardar el token en la base de datos: ${error.message}`);
  }
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

// Cierra sesión de la cuenta de Drive conectada: le avisa a Google que ya no
// queremos el token (revoke), borra TODO lo que se sincronizó de ese Drive
// (grupos, alumnos y asistencias — nada se queda guardado) y borra el
// refresh_token guardado. Los archivos reales en el Drive del profesor NUNCA
// se tocan: al volver a conectar, el explorador de Drive los va a mostrar
// tal cual estaban, listos para "convertir a grupo" de nuevo.
export async function desconectarDrive(profesorId: string): Promise<void> {
  const supabase = supabaseServer();

  // 1) Borrar todo lo sincronizado de Drive para este profesor.
  //    alumnos y registros_asistencia tienen "on delete cascade" hacia
  //    grupos/alumnos, así que basta con borrar los grupos.
  const { data: grupos } = await supabase.from('grupos').select('id').eq('profesor_id', profesorId);
  const grupoIds = (grupos || []).map((g) => g.id);

  if (grupoIds.length > 0) {
    // sesiones_qr no tiene FK con cascade garantizado — se borra aparte y
    // sin frenar el resto si la tabla no existe o falla.
    try {
      await supabase.from('sesiones_qr').delete().in('grupo_id', grupoIds);
    } catch {
      // no bloquear la desconexión por esto
    }
  }

  await supabase.from('grupos').delete().eq('profesor_id', profesorId);

  // 2) Revocar el token con Google y borrar nuestro registro.
  const { data } = await supabase
    .from('google_tokens')
    .select('refresh_token')
    .eq('profesor_id', profesorId)
    .maybeSingle();

  if (data?.refresh_token) {
    try {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `token=${encodeURIComponent(data.refresh_token)}`
      });
    } catch {
      // Si Google no responde (o el token ya estaba revocado del otro lado),
      // igual seguimos y borramos nuestro registro — lo importante es que
      // esta app deje de tener el token guardado.
    }
  }

  await supabase.from('google_tokens').delete().eq('profesor_id', profesorId);
}
