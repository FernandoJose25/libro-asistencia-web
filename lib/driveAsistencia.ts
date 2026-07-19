import { Readable } from 'stream';
import * as XLSX from 'xlsx';
import { driveClient, MIME_FOLDER, MIME_XLSX } from './drive';

// Todo lo necesario para la sección "Asistencia"/"Grupos": cada grupo es una
// carpeta en Drive, y guarda cada toma de asistencia respetando la ruta
// GRUPOS/<Grupo>/<dd-mm-aaaa>/Clase N.xlsx — "buscar o crear" en cada nivel
// para no duplicar carpetas ni archivos al reingresar el mismo día.

// El profesor puede borrar carpetas directamente desde su Google Drive; el
// carpeta_drive_id guardado en Supabase queda apuntando a un id que ya no
// existe (o está en la papelera). Si no se detecta esto antes de reusar el
// id como padre, Drive simplemente no encuentra hijos ahí y la app termina
// recreando todo bajo una carpeta "fantasma", desincronizada de lo que el
// profesor ve en su Drive real.
async function carpetaExiste(accessToken: string, carpetaId: string): Promise<boolean> {
  const drive = driveClient(accessToken);
  try {
    const res = await drive.files.get({ fileId: carpetaId, fields: 'id, trashed' });
    return !res.data.trashed;
  } catch {
    return false;
  }
}

export async function buscarOCrearCarpeta(accessToken: string, nombre: string, padreId?: string) {
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
  filas: { nombre: string; estatus: string; observacion: string; fecha: string; hora: string }[]
) {
  const drive = driveClient(accessToken);

  const ws = XLSX.utils.aoa_to_sheet([
    ['Nombre', 'Estado', 'Observación', 'Fecha', 'Hora'],
    ...filas.map((f) => [f.nombre, f.estatus, f.observacion, f.fecha, f.hora])
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

// Crea (o reutiliza) la carpeta GRUPOS/<nombreGrupo> — se llama una vez al
// crear el grupo desde la sección Grupos.
export async function crearCarpetaGrupo(accessToken: string, nombreGrupo: string) {
  const carpetaGrupos = await buscarOCrearCarpeta(accessToken, 'GRUPOS');
  return buscarOCrearCarpeta(accessToken, nombreGrupo, carpetaGrupos);
}

export async function sincronizarAsistenciaADrive(
  accessToken: string,
  opciones: {
    grupoNombre: string; // ya sanitizado con sanitizarNombreArchivo
    carpetaGrupoId?: string | null; // si ya se conoce, evita rebuscar GRUPOS/<Grupo>
    fechaCarpeta: string; // dd-mm-aaaa
    clase: 1 | 2;
    filas: { nombre: string; estatus: string; observacion: string; fecha: string; hora: string }[];
    carpetaDestinoId?: string; // si viene, se guarda ahí directo, sin la jerarquía GRUPOS/Grupo/fecha
  }
) {
  if (opciones.carpetaDestinoId) {
    if (!(await carpetaExiste(accessToken, opciones.carpetaDestinoId))) {
      throw new Error('La carpeta seleccionada ya no existe en Drive (fue eliminada). Elige otra carpeta destino.');
    }
    const archivoId = await buscarOEscribirExcel(
      accessToken,
      `Clase ${opciones.clase}.xlsx`,
      opciones.carpetaDestinoId,
      opciones.filas
    );
    return { archivoId, carpetaGrupoId: opciones.carpetaDestinoId };
  }

  const carpetaGrupoGuardada =
    opciones.carpetaGrupoId && (await carpetaExiste(accessToken, opciones.carpetaGrupoId))
      ? opciones.carpetaGrupoId
      : null;
  const carpetaGrupo = carpetaGrupoGuardada || (await crearCarpetaGrupo(accessToken, opciones.grupoNombre));
  const carpetaFecha = await buscarOCrearCarpeta(accessToken, opciones.fechaCarpeta, carpetaGrupo);

  const archivoId = await buscarOEscribirExcel(
    accessToken,
    `Clase ${opciones.clase}.xlsx`,
    carpetaFecha,
    opciones.filas
  );

  return { archivoId, carpetaGrupoId: carpetaGrupo };
}

// Mueve todo lo que haya bajo ASISTENCIA/<fecha>/Clase N/<Grupo>.xlsx hacia
// GRUPOS/<Grupo>/<fecha>/Clase N.xlsx — solo se dispara manualmente desde un
// botón en Drive, nunca de forma automática (mueve archivos reales del
// profesor). Devuelve cuántos archivos movió, para mostrar un resumen.
export async function migrarAsistenciaAGrupos(accessToken: string): Promise<{ movidos: number; errores: string[] }> {
  const drive = driveClient(accessToken);
  const errores: string[] = [];
  let movidos = 0;

  const raiz = await drive.files.list({
    q: `'root' in parents and name = 'ASISTENCIA' and mimeType = '${MIME_FOLDER}' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1
  });
  const carpetaAsistencia = raiz.data.files?.[0];
  if (!carpetaAsistencia?.id) return { movidos: 0, errores: [] };

  const fechas = await drive.files.list({
    q: `'${carpetaAsistencia.id}' in parents and mimeType = '${MIME_FOLDER}' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1000
  });

  for (const carpetaFecha of fechas.data.files || []) {
    if (!carpetaFecha.id || !carpetaFecha.name) continue;

    const clases = await drive.files.list({
      q: `'${carpetaFecha.id}' in parents and mimeType = '${MIME_FOLDER}' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 10
    });

    for (const carpetaClase of clases.data.files || []) {
      if (!carpetaClase.id || !carpetaClase.name) continue;
      const clase = carpetaClase.name.replace(/\D/g, '') || '1';

      const archivos = await drive.files.list({
        q: `'${carpetaClase.id}' in parents and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 1000
      });

      for (const archivo of archivos.data.files || []) {
        if (!archivo.id || !archivo.name) continue;
        const nombreGrupo = archivo.name.replace(/\.xlsx$/i, '');
        try {
          const carpetaGrupo = await crearCarpetaGrupo(accessToken, nombreGrupo);
          const carpetaFechaDestino = await buscarOCrearCarpeta(accessToken, carpetaFecha.name, carpetaGrupo);

          await drive.files.update({
            fileId: archivo.id,
            addParents: carpetaFechaDestino,
            removeParents: carpetaClase.id
          });
          await drive.files.update({ fileId: archivo.id, requestBody: { name: `Clase ${clase}.xlsx` } });
          movidos++;
        } catch (e: any) {
          errores.push(`${nombreGrupo} (${carpetaFecha.name}, clase ${clase}): ${e.message || 'error desconocido'}`);
        }
      }
    }
  }

  return { movidos, errores };
}
