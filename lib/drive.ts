import { google } from 'googleapis';
import * as XLSX from 'xlsx';

/**
 * Todas estas funciones reciben `accessToken`: el provider_token que Supabase
 * devuelve tras el login con Google (session.provider_token). Ese token viene
 * de la sesión de Google del profesor, autorizado con el scope de Drive.
 *
 * IMPORTANTE (léelo antes de ir a producción con varios profesores):
 * el provider_token de Supabase expira (normalmente ~1h) y Supabase no lo
 * refresca automáticamente para llamadas a APIs de terceros. Para una v1
 * de un solo profesor esto es aceptable (basta con volver a iniciar sesión
 * si expira). Para producción real, conviene guardar el refresh_token de
 * Google (scope "offline") cifrado y renovarlo desde un endpoint propio.
 */

function driveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MIME_CSV = 'text/csv';
const MIME_GSHEET = 'application/vnd.google-apps.spreadsheet';

export interface ArchivoDrive {
  id: string;
  nombre: string;
  mimeType: string;
}

// Lista los archivos "reconocibles" (xlsx/csv/Google Sheet) dentro de una carpeta.
export async function listarArchivosDeCarpeta(accessToken: string, carpetaId: string): Promise<ArchivoDrive[]> {
  const drive = driveClient(accessToken);
  const res = await drive.files.list({
    q: `'${carpetaId}' in parents and trashed = false and (mimeType='${MIME_XLSX}' or mimeType='${MIME_CSV}' or mimeType='${MIME_GSHEET}')`,
    fields: 'files(id, name, mimeType)',
    pageSize: 200
  });
  return (res.data.files || []).map((f) => ({
    id: f.id as string,
    nombre: (f.name as string).replace(/\.(xlsx|csv)$/i, ''),
    mimeType: f.mimeType as string
  }));
}

// Descarga un archivo y devuelve la lista de nombres de alumnos (primera columna, sin encabezado).
export async function leerAlumnosDeArchivo(accessToken: string, archivoId: string, mimeType: string): Promise<string[]> {
  const drive = driveClient(accessToken);
  let buffer: ArrayBuffer;

  if (mimeType === MIME_GSHEET) {
    const res = await drive.files.export(
      { fileId: archivoId, mimeType: MIME_XLSX },
      { responseType: 'arraybuffer' }
    );
    buffer = res.data as ArrayBuffer;
  } else {
    const res = await drive.files.get(
      { fileId: archivoId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    buffer = res.data as ArrayBuffer;
  }

  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Se asume: primera fila = encabezado ("Nombre", ...), columna A = nombre del alumno.
  return rows
    .slice(1)
    .map((r) => (r[0] || '').toString().trim())
    .filter((n) => n.length > 0);
}

// Sobrescribe el archivo en Drive con el estado actual de asistencia (nombre + estatus del día).
export async function escribirAsistenciaEnArchivo(
  accessToken: string,
  archivoId: string,
  filas: { nombre: string; estatus: string }[]
) {
  const drive = driveClient(accessToken);

  const ws = XLSX.utils.aoa_to_sheet([
    ['Nombre', 'Estatus'],
    ...filas.map((f) => [f.nombre, f.estatus])
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  await drive.files.update({
    fileId: archivoId,
    media: {
      mimeType: MIME_XLSX,
      body: buffer
    }
  });
}
