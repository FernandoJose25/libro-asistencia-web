import * as XLSX from 'xlsx';

export interface FilaAlumnoImportado {
  apellidos: string | null;
  nombres: string | null;
  nombreCompleto: string;
  grupoNombre: string | null;
}

const ALIAS_COLUMNAS: Record<'nro' | 'apellidos' | 'nombres' | 'grupo', string[]> = {
  nro: ['nro', 'n°', 'no', 'numero', '#', 'item'],
  apellidos: ['apellidos', 'apellido'],
  nombres: ['nombres', 'nombre'],
  grupo: ['grupo', 'curso', 'seccion', 'sección']
};

function normalizar(texto: string) {
  return texto
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function detectarColumnas(encabezado: string[]) {
  const indices: Partial<Record<'apellidos' | 'nombres' | 'grupo', number>> = {};
  encabezado.forEach((col, i) => {
    const norm = normalizar(col);
    for (const [campo, alias] of Object.entries(ALIAS_COLUMNAS)) {
      if (campo === 'nro') continue;
      if (alias.includes(norm) && indices[campo as 'apellidos' | 'nombres' | 'grupo'] === undefined) {
        indices[campo as 'apellidos' | 'nombres' | 'grupo'] = i;
      }
    }
  });
  return indices;
}

// Lee un .xlsx/.xls/.csv y reconoce encabezados de "Nro/Apellidos/Nombres/Grupo"
// en cualquier orden. Si no reconoce columnas separadas de apellidos/nombres,
// cae al comportamiento simple: primera columna = nombre completo (sin
// encabezado), igual que el import original.
export async function leerAlumnosDeArchivoLocal(archivo: File): Promise<FilaAlumnoImportado[]> {
  const buffer = await archivo.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length === 0) return [];

  const encabezado = (rows[0] || []).map((c) => (c ?? '').toString());
  const indices = detectarColumnas(encabezado);
  const tieneColumnasSeparadas = indices.apellidos !== undefined && indices.nombres !== undefined;

  if (!tieneColumnasSeparadas) {
    // Fallback: primera columna sin encabezado = nombre completo.
    return rows
      .slice(1)
      .map((r) => (r[0] || '').toString().trim())
      .filter((n) => n.length > 0)
      .map((nombreCompleto) => ({ apellidos: null, nombres: null, nombreCompleto, grupoNombre: null }));
  }

  return rows
    .slice(1)
    .map((r) => {
      const apellidos = (r[indices.apellidos!] || '').toString().trim();
      const nombres = (r[indices.nombres!] || '').toString().trim();
      const grupoNombre = indices.grupo !== undefined ? (r[indices.grupo] || '').toString().trim() : '';
      const nombreCompleto = [apellidos, nombres].filter(Boolean).join(' ').trim();
      return {
        apellidos: apellidos || null,
        nombres: nombres || null,
        nombreCompleto,
        grupoNombre: grupoNombre || null
      };
    })
    .filter((f) => f.nombreCompleto.length > 0);
}

// Busca un grupo por nombre (case-insensitive) entre los ya cargados, o lo
// crea vía /api/grupos/crear (mismo endpoint que usa "+ Nuevo grupo"), para
// que quede con su carpeta en Drive igual que uno creado a mano. Cachea el
// mapeo nombre→id durante la importación para no crear duplicados.
export async function resolverGrupoPorNombre(
  nombre: string,
  gruposExistentes: { id: string; nombre: string }[],
  cache: Map<string, string>
): Promise<{ id: string; creado: boolean }> {
  const clave = normalizar(nombre);
  if (cache.has(clave)) return { id: cache.get(clave)!, creado: false };

  const existente = gruposExistentes.find((g) => normalizar(g.nombre) === clave);
  if (existente) {
    cache.set(clave, existente.id);
    return { id: existente.id, creado: false };
  }

  const res = await fetch('/api/grupos/crear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `No se pudo crear el grupo "${nombre}".`);
  cache.set(clave, data.grupoId);
  return { id: data.grupoId, creado: true };
}
