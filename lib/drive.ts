import { google } from 'googleapis';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';

/**
 * Todas estas funciones reciben `accessToken`, que ahora siempre viene de
 * `obtenerAccessToken(profesorId)` (lib/googleAuth.ts) — un access_token
 * fresco renovado con el refresh_token guardado del profesor. Ningún
 * componente de cliente maneja tokens de Google directamente.
 */

function driveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

export const MIME_FOLDER = 'application/vnd.google-apps.folder';
export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MIME_CSV = 'text/csv';
export const MIME_GSHEET = 'application/vnd.google-apps.spreadsheet';

const MIME_ASISTENCIA = [MIME_XLSX, MIME_CSV, MIME_GSHEET];

export function esArchivoDeAsistencia(mimeType: string) {
  return MIME_ASISTENCIA.includes(mimeType);
}

export interface ItemDrive {
  id: string;
  nombre: string;
  mimeType: string;
  esCarpeta: boolean;
  esAsistencia: boolean;
  iconLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  parents?: string[];
}

// Lista TODO lo que hay dentro de una carpeta (o la raíz del Drive si no se
// pasa carpetaId) — carpetas y archivos de cualquier tipo, igual que el
// Drive real. Las carpetas van primero, luego archivos por nombre.
export async function listarCarpeta(accessToken: string, carpetaId?: string): Promise<ItemDrive[]> {
  const drive = driveClient(accessToken);
  const padre = carpetaId || 'root';
  const res = await drive.files.list({
    q: `'${padre}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, iconLink, thumbnailLink, modifiedTime, size, webViewLink, parents)',
    orderBy: 'folder,name_natural',
    pageSize: 1000
  });

  return (res.data.files || []).map((f) => ({
    id: f.id as string,
    nombre: f.name as string,
    mimeType: f.mimeType as string,
    esCarpeta: f.mimeType === MIME_FOLDER,
    esAsistencia: esArchivoDeAsistencia(f.mimeType as string),
    iconLink: f.iconLink || undefined,
    thumbnailLink: f.thumbnailLink || undefined,
    modifiedTime: f.modifiedTime || undefined,
    size: f.size || undefined,
    webViewLink: f.webViewLink || undefined,
    parents: f.parents || undefined
  }));
}

// Ruta (breadcrumb) desde la raíz hasta la carpeta actual, para mostrar
// "Mi unidad / Carpeta A / Carpeta B" arriba del explorador.
export async function ruta(accessToken: string, carpetaId?: string): Promise<{ id: string; nombre: string }[]> {
  if (!carpetaId || carpetaId === 'root') return [];
  const drive = driveClient(accessToken);
  const items: { id: string; nombre: string }[] = [];
  let actualId: string | undefined = carpetaId;

  while (actualId) {
    const res: any = await drive.files.get({ fileId: actualId, fields: 'id, name, parents' });
    items.unshift({ id: res.data.id as string, nombre: res.data.name as string });
    actualId = res.data.parents?.[0];
    if (items.length > 20) break; // por seguridad, evita loops
  }
  return items;
}

export async function buscarEnDrive(accessToken: string, texto: string): Promise<ItemDrive[]> {
  const drive = driveClient(accessToken);
  const res = await drive.files.list({
    q: `name contains '${texto.replace(/'/g, "\\'")}' and trashed = false`,
    fields: 'files(id, name, mimeType, iconLink, thumbnailLink, modifiedTime, size, webViewLink, parents)',
    pageSize: 50
  });
  return (res.data.files || []).map((f) => ({
    id: f.id as string,
    nombre: f.name as string,
    mimeType: f.mimeType as string,
    esCarpeta: f.mimeType === MIME_FOLDER,
    esAsistencia: esArchivoDeAsistencia(f.mimeType as string),
    iconLink: f.iconLink || undefined,
    thumbnailLink: f.thumbnailLink || undefined,
    modifiedTime: f.modifiedTime || undefined,
    size: f.size || undefined,
    webViewLink: f.webViewLink || undefined,
    parents: f.parents || undefined
  }));
}

export async function crearCarpeta(accessToken: string, nombre: string, carpetaPadreId?: string) {
  const drive = driveClient(accessToken);
  const res = await drive.files.create({
    requestBody: {
      name: nombre,
      mimeType: MIME_FOLDER,
      parents: carpetaPadreId ? [carpetaPadreId] : undefined
    },
    fields: 'id, name, mimeType'
  });
  return res.data;
}

export async function subirArchivo(
  accessToken: string,
  nombre: string,
  mimeType: string,
  buffer: Buffer,
  carpetaId?: string
) {
  const drive = driveClient(accessToken);
  const res = await drive.files.create({
    requestBody: { name: nombre, parents: carpetaId ? [carpetaId] : undefined },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id, name, mimeType'
  });
  return res.data;
}

export async function renombrarArchivo(accessToken: string, archivoId: string, nuevoNombre: string) {
  const drive = driveClient(accessToken);
  await drive.files.update({ fileId: archivoId, requestBody: { name: nuevoNombre } });
}

export async function moverArchivo(accessToken: string, archivoId: string, nuevaCarpetaId: string) {
  const drive = driveClient(accessToken);
  const actual = await drive.files.get({ fileId: archivoId, fields: 'parents' });
  await drive.files.update({
    fileId: archivoId,
    addParents: nuevaCarpetaId,
    removeParents: (actual.data.parents || []).join(',')
  });
}

export async function copiarArchivo(accessToken: string, archivoId: string, nuevoNombre: string, carpetaId?: string) {
  const drive = driveClient(accessToken);
  const res = await drive.files.copy({
    fileId: archivoId,
    requestBody: { name: nuevoNombre, parents: carpetaId ? [carpetaId] : undefined }
  });
  return res.data;
}

export async function eliminarArchivo(accessToken: string, archivoId: string) {
  const drive = driveClient(accessToken);
  await drive.files.update({ fileId: archivoId, requestBody: { trashed: true } });
}

// Crea un archivo .xlsx nuevo en Drive con el formato de asistencia
// (Nombre | Estatus), listo para usarse como grupo — para cuando el
// profesor no tiene todavía un Excel de asistencia y quiere crear el curso
// desde cero en vez de tener que "importar" algo primero.
export async function crearArchivoAsistenciaDesdeCero(
  accessToken: string,
  nombre: string,
  alumnos: string[],
  carpetaId?: string
) {
  const drive = driveClient(accessToken);

  const ws = XLSX.utils.aoa_to_sheet([
    ['Nombre', 'Estatus'],
    ...alumnos.map((n) => [n, 'asistio'])
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const res = await drive.files.create({
    requestBody: {
      name: `${nombre}.xlsx`,
      parents: carpetaId ? [carpetaId] : undefined
    },
    media: { mimeType: MIME_XLSX, body: Readable.from(buffer) },
    fields: 'id, name, mimeType'
  });
  return res.data;
}
// navegador). Los Google Docs/Sheets/Slides no tienen bytes descargables
// directos, así que se exportan al formato equivalente de Office.
export async function descargarArchivo(
  accessToken: string,
  archivoId: string,
  mimeType: string
): Promise<{ buffer: Buffer; nombre: string; mimeSalida: string }> {
  const drive = driveClient(accessToken);
  const meta = await drive.files.get({ fileId: archivoId, fields: 'name' });
  const nombreBase = (meta.data.name as string) || 'archivo';

  const exportMap: Record<string, { mime: string; ext: string }> = {
    'application/vnd.google-apps.spreadsheet': { mime: MIME_XLSX, ext: '.xlsx' },
    'application/vnd.google-apps.document': {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ext: '.docx'
    },
    'application/vnd.google-apps.presentation': {
      mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ext: '.pptx'
    }
  };

  if (exportMap[mimeType]) {
    const { mime, ext } = exportMap[mimeType];
    const res = await drive.files.export({ fileId: archivoId, mimeType: mime }, { responseType: 'arraybuffer' });
    return { buffer: Buffer.from(res.data as ArrayBuffer), nombre: nombreBase + ext, mimeSalida: mime };
  }

  const res = await drive.files.get({ fileId: archivoId, alt: 'media' }, { responseType: 'arraybuffer' });
  return { buffer: Buffer.from(res.data as ArrayBuffer), nombre: nombreBase, mimeSalida: mimeType };
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
// Funciona tanto si el archivo original es .xlsx/.csv como si es un Google Sheet
// (en ese caso Drive lo sigue tratando como Google Sheet: subimos el xlsx y
// Drive lo convierte solo, porque el archivo ya es de tipo Google Sheet).
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
      body: Readable.from(buffer)
    }
  });
}
