import { Readable } from 'stream';
import * as XLSX from 'xlsx';
import { driveClient, MIME_FOLDER, MIME_XLSX } from './drive';

// Todo lo necesario para la sección "Asistencia": guarda cada toma de
// asistencia en Google Drive respetando la ruta
// ASISTENCIA/<dd-mm-aaaa>/[Clase N/]<Grupo>.xlsx — "buscar o crear" en cada
// nivel para no duplicar carpetas ni archivos al reingresar el mismo día.

async function buscarOCrearCarpeta(accessToken: string, nombre: string, padreId?: string) {
  const drive = driveClient(accessToken);
  const padre = padreId || 'root';
  const nombreEscapado = nombre.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${padre}' in parents and name = '${nombreEscapado}' and mimeType = '${MIME_FOLDER}' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1
  });
  const existente = res.data.files?.[0];
  if (existente?.id) return existente.id;

  const creada = await drive.files.create({
    requestBody: { name: nombre, mimeType: MIME_FOLDER, parents: [padre] },
    fields: 'id'
  });
  return creada.data.id as string;
}

async function buscarOEscribirExcel(
  accessToken: string,
  nombreArchivo: string,
  carpetaId: string,
  filas: { nombre: string; estatus: string; fecha: string; hora: string }[]
) {
  const drive = driveClient(accessToken);

  const ws = XLSX.utils.aoa_to_sheet([
    ['Nombre', 'Estatus', 'Fecha', 'Hora'],
    ...filas.map((f) => [f.nombre, f.estatus, f.fecha, f.hora])
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const nombreEscapado = nombreArchivo.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${carpetaId}' in parents and name = '${nombreEscapado}' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1
  });
  const existente = res.data.files?.[0];

  if (existente?.id) {
    await drive.files.update({
      fileId: existente.id,
      media: { mimeType: MIME_XLSX, body: Readable.from(buffer) }
    });
    return existente.id;
  }

  const creado = await drive.files.create({
    requestBody: { name: nombreArchivo, parents: [carpetaId] },
    media: { mimeType: MIME_XLSX, body: Readable.from(buffer) },
    fields: 'id'
  });
  return creado.data.id as string;
}

export async function sincronizarAsistenciaADrive(
  accessToken: string,
  opciones: {
    grupoNombreArchivo: string; // ya sanitizado con sanitizarNombreArchivo
    fechaCarpeta: string; // dd-mm-aaaa
    clase: 1 | 2 | null; // null = una sola clase ese día, sin subcarpeta "Clase N"
    filas: { nombre: string; estatus: string; fecha: string; hora: string }[];
  }
) {
  const carpetaAsistencia = await buscarOCrearCarpeta(accessToken, 'ASISTENCIA');
  const carpetaFecha = await buscarOCrearCarpeta(accessToken, opciones.fechaCarpeta, carpetaAsistencia);
  const carpetaDestino = opciones.clase
    ? await buscarOCrearCarpeta(accessToken, `Clase ${opciones.clase}`, carpetaFecha)
    : carpetaFecha;

  return buscarOEscribirExcel(accessToken, `${opciones.grupoNombreArchivo}.xlsx`, carpetaDestino, opciones.filas);
}
