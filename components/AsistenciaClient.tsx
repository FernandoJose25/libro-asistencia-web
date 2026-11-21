'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { Alumno, Estatus } from '@/lib/types';
import { fechaLocalISO, sanitizarNombreArchivo } from '@/lib/utils';
import { exportarAsistenciaExcel, exportarAsistenciaPDF } from '@/lib/exportAsistencia';
import { formatearObservacion } from '@/lib/formatearAsistenciaExport';
import { StatusPillGroup } from './StatusPill';
import { AttendanceHeatmap } from './AttendanceHeatmap';
import { AiSummaryButton } from './AiSummaryButton';
import { JustificarPopover, type MotivoJustificacion } from './JustificarPopover';
import { MiniCalendario, MESES } from './MiniCalendario';
import { SeleccionarCarpetaDriveModal } from './SeleccionarCarpetaDriveModal';
import { Icono } from './Icono';

interface RegistroInicial {
  estatus: Estatus;
  marcado_en: string;
  justificada: boolean;
  justificacion_motivo: MotivoJustificacion | null;
  justificacion_detalle: string | null;
}

interface Riesgo {
  porcentajeFalta: number;
  totalFaltas: number;
  enRiesgo: boolean;
}

interface Fila {
  alumno: Alumno;
  estatus: Estatus;
  marcadoEn: string | null;
  justificada: boolean;
  justificacionMotivo: MotivoJustificacion | null;
  justificacionDetalle: string;
}

// Copia en localStorage de lo marcado y aún no guardado, por grupo/fecha/hora.
// Si el navegador recarga la página (gesto de "jalar para recargar", el
// sistema cierra la pestaña, se va la señal), al volver se recupera.
interface BorradorFila {
  id: string;
  estatus: Estatus;
  marcadoEn: string | null;
  justificada: boolean;
  motivo: MotivoJustificacion | null;
  detalle: string;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function formatearFecha(fechaISO: string) {
  const [anio, mes, dia] = fechaISO.split('-');
  return `${dia}/${mes}/${anio}`;
}

function fechaLarga(fechaISO: string) {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  return `${DIAS[new Date(anio, mes - 1, dia).getDay()]} ${dia} de ${MESES[mes - 1].toLowerCase()}`;
}

function formatearHora(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function Cifra({ label, valor, color, detalle }: { label: string; valor: number; color?: string; detalle?: React.ReactNode }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0 min-w-0">
      <div className="text-[11.5px] uppercase tracking-[0.08em] font-bold text-inkSoft">{label}</div>
      <div className={`font-display text-[34px] leading-none font-semibold tabular-nums mt-1 ${color || 'text-ink'}`}>{valor}</div>
      {detalle && <div className="text-[12px] text-inkSoft mt-1.5 leading-snug">{detalle}</div>}
    </div>
  );
}

export function AsistenciaClient({
  grupoId,
  grupoNombre,
  alumnosIniciales,
  fechaInicial,
  registrosIniciales,
  sesionesGuardadas,
  umbralInicial,
  horasClaseSemanaInicial,
  faltasPermitidasSemestreInicial,
  riesgoPorAlumno,
  diasHeatmap
}: {
  grupoId: string;
  grupoNombre: string;
  alumnosIniciales: Alumno[];
  fechaInicial: string;
  registrosIniciales: Record<string, RegistroInicial>;
  sesionesGuardadas: string[]; // "YYYY-MM-DD|clase" con asistencia en la base
  umbralInicial: number;
  horasClaseSemanaInicial: number;
  faltasPermitidasSemestreInicial: number;
  riesgoPorAlumno: Record<string, Riesgo>;
  diasHeatmap: { fecha: string; tasaAsistencia: number }[];
}) {
  const supabase = supabaseBrowser();
  const nombreArchivoBase = sanitizarNombreArchivo(grupoNombre);

  const umbral = umbralInicial;
  const horasClaseSemana = horasClaseSemanaInicial;
  const faltasPermitidasSemestre = faltasPermitidasSemestreInicial;

  const construirFilas = (registro: (alumnoId: string) => RegistroInicial | undefined): Fila[] =>
    alumnosIniciales.map((a) => {
      const r = registro(a.id);
      return {
        alumno: a,
        estatus: r?.estatus || 'falto',
        marcadoEn: r?.marcado_en || null,
        justificada: r?.justificada || false,
        justificacionMotivo: r?.justificacion_motivo || null,
        justificacionDetalle: r?.justificacion_detalle || ''
      };
    });

  // fecha/clase = lo elegido en los controles; cargado = a qué fecha/clase
  // pertenecen las filas en pantalla (va detrás mientras carga otro día).
  const [fecha, setFecha] = useState(fechaInicial);
  const [clase, setClase] = useState<1 | 2>(1);
  const [cargado, setCargado] = useState<{ fecha: string; clase: 1 | 2 }>({ fecha: fechaInicial, clase: 1 });
  const [filas, setFilas] = useState<Fila[]>(() => construirFilas((id) => registrosIniciales[id]));
  const [sesiones, setSesiones] = useState(() => new Set(sesionesGuardadas));
  const [dirty, setDirty] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<string | null>(null);
  const [borradorRecuperado, setBorradorRecuperado] = useState(false);
  const [online, setOnline] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [errorSync, setErrorSync] = useState('');
  const [justificandoId, setJustificandoId] = useState<string | null>(null);
  const [menuGuardarAbierto, setMenuGuardarAbierto] = useState(false);
  const [modalCarpetaAbierto, setModalCarpetaAbierto] = useState(false);
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  const [copiandoHora1, setCopiandoHora1] = useState(false);
  const [copiadoHora1, setCopiadoHora1] = useState(false);
  const [sinClasesAbierto, setSinClasesAbierto] = useState(false);
  const [motivoSinClases, setMotivoSinClases] = useState('');
  const [justificandoDia, setJustificandoDia] = useState(false);
  const [diaJustificado, setDiaJustificado] = useState('');
  const cargaActual = useRef(0);
  const edicion = useRef(0); // sube con cada cambio: detecta ediciones hechas mientras se guardaba

  const claveBorrador = (f: string, c: number) => `asistencia-borrador:${grupoId}:${f}:${c}`;

  function leerBorrador(f: string, c: number): BorradorFila[] | null {
    try {
      const raw = localStorage.getItem(claveBorrador(f, c));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function descartarBorrador(f: string, c: number) {
    try {
      localStorage.removeItem(claveBorrador(f, c));
    } catch {
      /* almacenamiento no disponible */
    }
  }

  // Pinta las filas de una fecha/clase aplicando encima el borrador local, si hay.
  function mostrarFilas(base: Fila[], f: string, c: 1 | 2) {
    const borrador = leerBorrador(f, c);
    let resultado = base;
    if (borrador) {
      const mapa = new Map(borrador.map((b) => [b.id, b]));
      resultado = base.map((fila) => {
        const b = mapa.get(fila.alumno.id);
        return b
          ? { ...fila, estatus: b.estatus, marcadoEn: b.marcadoEn, justificada: b.justificada, justificacionMotivo: b.motivo, justificacionDetalle: b.detalle }
          : fila;
      });
    }
    setFilas(resultado);
    setDirty(!!borrador);
    setBorradorRecuperado(!!borrador);
    setCargado({ fecha: f, clase: c });
    setGuardadoEn(null);
    setErrorSync('');
    setCopiadoHora1(false);
    setDiaJustificado('');
  }

  // Al abrir: usar la fecha local del dispositivo (el servidor solo la estima)
  // y recuperar lo marcado sin guardar si la página se había recargado.
  useEffect(() => {
    const hoyLocal = fechaLocalISO();
    if (hoyLocal !== fechaInicial) {
      setFecha(hoyLocal);
      cargarFechaClase(hoyLocal, 1);
    } else {
      mostrarFilas(filas, fechaInicial, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const borrador: BorradorFila[] = filas.map((f) => ({
      id: f.alumno.id,
      estatus: f.estatus,
      marcadoEn: f.marcadoEn,
      justificada: f.justificada,
      motivo: f.justificacionMotivo,
      detalle: f.justificacionDetalle
    }));
    try {
      localStorage.setItem(claveBorrador(cargado.fecha, cargado.clase), JSON.stringify(borrador));
    } catch {
      /* almacenamiento lleno o bloqueado: queda solo en memoria */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, dirty, cargado]);

  // Aviso nativo del navegador si intenta recargar o salir con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [dirty]);

  const guardarRef = useRef<() => void>(() => {});
  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => {
      setOnline(true);
      if (dirty) guardarRef.current();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [dirty]);

  useEffect(() => {
    localStorage.setItem('ultimoGrupoAsistencia', grupoId);
  }, [grupoId]);

  async function cargarFechaClase(nuevaFecha: string, nuevaClase: 1 | 2) {
    const carga = ++cargaActual.current;
    setCargando(true);
    const { data: registros, error } = await supabase
      .from('asistencia_registros')
      .select('alumno_id, estatus, marcado_en, justificada, justificacion_motivo, justificacion_detalle')
      .eq('grupo_id', grupoId)
      .eq('fecha', nuevaFecha)
      .eq('clase', nuevaClase);

    if (carga !== cargaActual.current) return; // llegó tarde: ya se pidió otro día
    setCargando(false);

    if (error) {
      // Sin datos de ese día no se cambia la lista: guardar ahí pisaría la
      // asistencia real con todos en "Faltó".
      setFecha(cargado.fecha);
      setClase(cargado.clase);
      setErrorSync(`No se pudo cargar la asistencia de ese día: ${error.message}`);
      return;
    }

    const mapa = new Map((registros || []).map((r) => [r.alumno_id, r as RegistroInicial]));
    mostrarFilas(construirFilas((id) => mapa.get(id)), nuevaFecha, nuevaClase);
  }

  function cambiarFecha(nuevaFecha: string) {
    setFecha(nuevaFecha);
    setCalendarioAbierto(false);
    cargarFechaClase(nuevaFecha, clase);
  }

  function cambiarClase(nuevaClase: 1 | 2) {
    if (nuevaClase === clase) return;
    setClase(nuevaClase);
    cargarFechaClase(fecha, nuevaClase);
  }

  function marcarCambio() {
    edicion.current++;
    setDirty(true);
  }

  function cambiarEstatus(alumnoId: string, estatus: Estatus) {
    setFilas((prev) =>
      prev.map((f) =>
        f.alumno.id === alumnoId
          ? {
              ...f,
              estatus,
              marcadoEn: new Date().toISOString(),
              justificada: estatus === 'falto' ? f.justificada : false,
              justificacionMotivo: estatus === 'falto' ? f.justificacionMotivo : null,
              justificacionDetalle: estatus === 'falto' ? f.justificacionDetalle : ''
            }
          : f
      )
    );
    marcarCambio();
    if (estatus !== 'falto') setJustificandoId(null);
  }

  function guardarJustificacion(alumnoId: string, motivo: MotivoJustificacion, detalle: string) {
    setFilas((prev) =>
      prev.map((f) =>
        f.alumno.id === alumnoId
          ? { ...f, justificada: true, justificacionMotivo: motivo, justificacionDetalle: detalle }
          : f
      )
    );
    marcarCambio();
    setJustificandoId(null);
  }

  function quitarJustificacion(alumnoId: string) {
    setFilas((prev) =>
      prev.map((f) =>
        f.alumno.id === alumnoId
          ? { ...f, justificada: false, justificacionMotivo: null, justificacionDetalle: '' }
          : f
      )
    );
    marcarCambio();
  }

  function marcarTodosPresentes() {
    const ahora = new Date().toISOString();
    setFilas((prev) =>
      prev.map((f) => ({
        ...f,
        estatus: 'asistio' as Estatus,
        marcadoEn: ahora,
        justificada: false,
        justificacionMotivo: null,
        justificacionDetalle: ''
      }))
    );
    marcarCambio();
    setJustificandoId(null);
  }

  // Dos horas seguidas: la asistencia se pasa una sola vez y la Hora 2 repite
  // lo de la Hora 1 (asistió, retardo, faltó y justificaciones), porque cada
  // hora cuenta por separado en el total del parcial. Si la Hora 1 tiene algo
  // marcado sin guardar en este teléfono, se toma eso, que es lo más reciente.
  // Queda como cambio sin guardar para revisarlo antes de pulsar Guardar.
  async function copiarDeHora1() {
    const f = cargado.fecha;
    const carga = cargaActual.current;
    setCopiandoHora1(true);
    setErrorSync('');
    const { data, error } = await supabase
      .from('asistencia_registros')
      .select('alumno_id, estatus, justificada, justificacion_motivo, justificacion_detalle')
      .eq('grupo_id', grupoId)
      .eq('fecha', f)
      .eq('clase', 1);
    setCopiandoHora1(false);
    if (carga !== cargaActual.current) return; // cambió de día u hora mientras tanto

    if (error) {
      setErrorSync(`No se pudo leer la Hora 1: ${error.message}`);
      return;
    }
    const borrador = leerBorrador(f, 1);
    if (!data?.length && !borrador) {
      setErrorSync(`La Hora 1 del ${formatearFecha(f)} no tiene asistencia guardada todavía.`);
      return;
    }

    const guardados = new Map((data || []).map((r) => [r.alumno_id, r]));
    const sinGuardar = new Map((borrador || []).map((b) => [b.id, b]));
    const ahora = new Date().toISOString();
    setFilas((prev) =>
      prev.map((fila) => {
        const b = sinGuardar.get(fila.alumno.id);
        if (b) {
          return { ...fila, estatus: b.estatus, marcadoEn: ahora, justificada: b.justificada, justificacionMotivo: b.motivo, justificacionDetalle: b.detalle };
        }
        const r = guardados.get(fila.alumno.id);
        if (r) {
          return {
            ...fila,
            estatus: r.estatus as Estatus,
            marcadoEn: ahora,
            justificada: r.justificada,
            justificacionMotivo: r.justificacion_motivo as MotivoJustificacion | null,
            justificacionDetalle: r.justificacion_detalle || ''
          };
        }
        return fila;
      })
    );
    marcarCambio();
    setJustificandoId(null);
    setCopiadoHora1(true);
  }

  function descartarCambios() {
    descartarBorrador(cargado.fecha, cargado.clase);
    cargarFechaClase(cargado.fecha, cargado.clase);
  }

  async function guardarEnSupabase(f: string, clases: (1 | 2)[], lista: Fila[] = filas) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No hay sesión activa');

    const registros = clases.flatMap((c) => lista.map((fila) => ({
      alumno_id: fila.alumno.id,
      grupo_id: grupoId,
      profesor_id: user.id,
      fecha: f,
      clase: c,
      estatus: fila.estatus,
      marcado_en: fila.marcadoEn || new Date().toISOString(),
      justificada: fila.estatus === 'falto' ? fila.justificada : false,
      justificacion_motivo: fila.estatus === 'falto' && fila.justificada ? fila.justificacionMotivo : null,
      justificacion_detalle: fila.estatus === 'falto' && fila.justificada ? fila.justificacionDetalle : null
    })));
    const { error } = await supabase.from('asistencia_registros').upsert(registros, { onConflict: 'alumno_id,fecha,clase' });
    if (error) throw new Error(`No se pudo guardar en la base de datos: ${error.message}`);
  }

  async function sincronizarConDrive(f: string, c: 1 | 2, carpetaDestinoId?: string) {
    const res = await fetch(`/api/asistencia/sync/${grupoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha: f, clase: c, carpetaDestinoId })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || 'No se pudo sincronizar con Drive.');
    }
  }

  // Guarda en la base y copia el Excel a Drive (ruta automática o carpeta elegida).
  async function guardar(carpetaDestinoId?: string) {
    setMenuGuardarAbierto(false);
    setErrorSync('');
    if (!navigator.onLine) {
      setErrorSync('Sin conexión. Lo marcado queda guardado en este teléfono y se enviará al volver la señal.');
      return;
    }
    const { fecha: f, clase: c } = cargado;
    const version = edicion.current;
    setGuardando(true);
    try {
      await guardarEnSupabase(f, [c]);
    } catch (e: any) {
      setErrorSync(e.message || 'No se pudo guardar.');
      setGuardando(false);
      return;
    }

    setSesiones((prev) => new Set(prev).add(`${f}|${c}`));
    setBorradorRecuperado(false);
    setGuardadoEn(new Date().toISOString());
    if (edicion.current === version) {
      descartarBorrador(f, c);
      setDirty(false);
    }

    try {
      await sincronizarConDrive(f, c, carpetaDestinoId);
    } catch (e: any) {
      setErrorSync(`La asistencia quedó guardada, pero no se pudo copiar a Drive: ${e.message}`);
    } finally {
      setGuardando(false);
    }
  }
  guardarRef.current = () => guardar();

  // Día sin clases (feriado, día inhábil): el día cuenta dentro del parcial,
  // así que todos los alumnos quedan con falta justificada en la hora elegida
  // o en las dos, con el motivo escrito. Las justificadas suman al total de
  // asistencias. Se guarda directo, sin pasar por el botón Guardar.
  async function justificarDiaSinClases(horas: (1 | 2)[]) {
    const motivo = motivoSinClases.trim();
    const f = cargado.fecha;
    if (!motivo || filas.length === 0) return;
    setErrorSync('');
    setDiaJustificado('');
    if (!navigator.onLine) {
      setErrorSync('Sin conexión. Justifica el día cuando vuelva la señal.');
      return;
    }
    const conDatos = horas.filter((c) => sesiones.has(`${f}|${c}`) || leerBorrador(f, c));
    if (
      conDatos.length > 0 &&
      !confirm(
        `${conDatos.length === 2 ? 'Las horas 1 y 2' : `La Hora ${conDatos[0]}`} del ${formatearFecha(f)} ya ${
          conDatos.length === 2 ? 'tienen' : 'tiene'
        } asistencia. Se va a reemplazar: todos los alumnos quedarán con falta justificada. ¿Continuar?`
      )
    ) {
      return;
    }

    const carga = cargaActual.current;
    const ahora = new Date().toISOString();
    const justificadas: Fila[] = filas.map((fila) => ({
      ...fila,
      estatus: 'falto',
      marcadoEn: ahora,
      justificada: true,
      justificacionMotivo: 'otro',
      justificacionDetalle: motivo
    }));
    setJustificandoDia(true);
    try {
      await guardarEnSupabase(f, horas, justificadas);
    } catch (e: any) {
      setErrorSync(e.message || 'No se pudo justificar el día.');
      setJustificandoDia(false);
      return;
    }

    horas.forEach((c) => descartarBorrador(f, c));
    setSesiones((prev) => {
      const nuevas = new Set(prev);
      horas.forEach((c) => nuevas.add(`${f}|${c}`));
      return nuevas;
    });
    // Si mientras tanto eligió otro día u hora, no se le cambia la pantalla.
    if (carga === cargaActual.current) await cargarFechaClase(f, cargado.clase);
    setMotivoSinClases('');
    setDiaJustificado(
      `Listo: ${horas.length === 2 ? 'horas 1 y 2' : `Hora ${horas[0]}`} del ${formatearFecha(f).slice(0, 5)} justificada${
        horas.length === 2 ? 's' : ''
      } para los ${filas.length} alumnos.`
    );

    try {
      for (const c of horas) await sincronizarConDrive(f, c);
    } catch (e: any) {
      setErrorSync(`El día quedó justificado, pero no se pudo copiar a Drive: ${e.message}`);
    } finally {
      setJustificandoDia(false);
    }
  }

  function filasExport() {
    return filas.map((f) => ({
      nombre: f.alumno.nombre,
      estatus: f.estatus,
      observacion: formatearObservacion(f.estatus, f.justificada, f.justificacionMotivo, f.justificacionDetalle),
      fecha: formatearFecha(cargado.fecha),
      hora: formatearHora(f.marcadoEn)
    }));
  }

  function exportarExcel() {
    setMenuGuardarAbierto(false);
    exportarAsistenciaExcel(`${nombreArchivoBase}-${cargado.fecha}-hora${cargado.clase}`, filasExport());
  }

  function exportarPDF() {
    setMenuGuardarAbierto(false);
    exportarAsistenciaPDF(`${grupoNombre} — ${formatearFecha(cargado.fecha)} — Hora ${cargado.clase}`, filasExport());
  }

  // Faltas que activan la alerta: tope permitido * umbral (redondeo hacia arriba).
  const faltasParaAlerta =
    faltasPermitidasSemestre > 0 ? Math.ceil(faltasPermitidasSemestre * (umbral / 100)) : 0;
  // Zona amarilla (atención preventiva): a partir del 75% del umbral y aún no en riesgo.
  const umbralAtencion = umbral * 0.75;
  const enAtencion = (alumnoId: string) => {
    const r = riesgoPorAlumno[alumnoId];
    return !!r && !r.enRiesgo && r.porcentajeFalta >= umbralAtencion;
  };
  const filasEnRiesgo = filas.filter((f) => riesgoPorAlumno[f.alumno.id]?.enRiesgo);
  const filasEnAtencion = filas.filter((f) => enAtencion(f.alumno.id));
  const nombreFormal = (a: Alumno) => (a.apellidos && a.nombres ? `${a.apellidos}, ${a.nombres}` : a.nombre);

  const resumen = {
    total: filas.length,
    presentes: filas.filter((f) => f.estatus === 'asistio' || f.estatus === 'tardanza').length,
    aTiempo: filas.filter((f) => f.estatus === 'asistio').length,
    tardanzas: filas.filter((f) => f.estatus === 'tardanza').length,
    ausentes: filas.filter((f) => f.estatus === 'falto').length,
    justificados: filas.filter((f) => f.estatus === 'falto' && f.justificada).length
  };
  const pct = (n: number) => `${resumen.total ? (100 * n) / resumen.total : 0}%`;

  const diasConRegistro = new Set(Array.from(sesiones, (s) => s.split('|')[0]));
  const sesionGuardada = sesiones.has(`${cargado.fecha}|${cargado.clase}`);
  const estado = !online
    ? { texto: 'Sin conexión', tono: 'text-inkSoft', punto: 'bg-inkSoft' }
    : guardando
    ? { texto: 'Guardando…', tono: 'text-amber', punto: 'bg-amber animate-pulse' }
    : dirty
    ? { texto: 'Cambios sin guardar', tono: 'text-amber', punto: 'bg-amber' }
    : guardadoEn
    ? { texto: `Guardado · ${formatearHora(guardadoEn)}`, tono: 'text-green', punto: 'bg-green' }
    : sesionGuardada
    ? { texto: 'Guardado', tono: 'text-green', punto: 'bg-green' }
    : { texto: 'Sin registrar', tono: 'text-inkSoft', punto: 'bg-border' };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* overscroll contenido: el impulso al llegar arriba no pasa al navegador
          (si pasa, Chrome/Brave en Android recarga la página). */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain">
        <div className="max-w-[920px] mx-auto px-4 md:px-8 pt-5 md:pt-7 pb-8">
          <header className="mb-5">
            <p className="text-[11.5px] uppercase tracking-[0.16em] font-bold text-goldDark">Registro de asistencia</p>
            <h1 className="font-display text-[34px] md:text-[42px] font-semibold leading-[1.02] mt-1 break-words">{grupoNombre}</h1>
            <p className="mt-1.5 text-[15px] text-ink">
              {fechaLarga(fecha)} <span className="text-inkSoft">· Hora {clase}</span>
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-inkSoft leading-snug">
              <Icono nombre="ajustes" className="w-3.5 h-3.5 mt-0.5" />
              <span>
                Umbral {umbral}% · alerta desde {faltasParaAlerta} falta{faltasParaAlerta === 1 ? '' : 's'} · máximo {faltasPermitidasSemestre} · {horasClaseSemana} h/semana ·{' '}
                <Link href="/dashboard/grupos" className="font-bold text-goldDark underline-offset-2 hover:underline">
                  Editar
                </Link>
              </span>
            </p>
          </header>

          {(filasEnRiesgo.length > 0 || filasEnAtencion.length > 0) && (
            <details className="group mb-4 bg-white border border-border rounded-card overflow-hidden">
              <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none select-none hover:bg-bg/50">
                <span className="w-9 h-9 shrink-0 rounded-full bg-red/10 text-red flex items-center justify-center">
                  <Icono nombre="alerta" className="w-[18px] h-[18px]" />
                </span>
                <span className="flex-1 min-w-0 text-[14.5px] leading-snug">
                  {filasEnRiesgo.length > 0 && <b className="text-red">{filasEnRiesgo.length} en riesgo</b>}
                  {filasEnRiesgo.length > 0 && filasEnAtencion.length > 0 && <span className="text-inkSoft"> · </span>}
                  {filasEnAtencion.length > 0 && <b className="text-amber">{filasEnAtencion.length} en atención</b>}
                  <span className="block text-[12.5px] text-inkSoft">Toca para ver quiénes y cuántas faltas llevan</span>
                </span>
                <Icono nombre="abajo" className="w-5 h-5 text-inkSoft transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <div className="border-t border-rule px-4 py-3.5 grid gap-5 sm:grid-cols-2">
                {[
                  { titulo: `Superaron el umbral (${umbral}%)`, lista: filasEnRiesgo, tono: 'text-red', fondo: 'bg-red/10' },
                  { titulo: 'Acercándose al umbral', lista: filasEnAtencion, tono: 'text-amber', fondo: 'bg-amber/10' }
                ]
                  .filter((g) => g.lista.length > 0)
                  .map((g) => (
                    <div key={g.titulo}>
                      <h3 className={`text-[12px] uppercase tracking-[0.08em] font-bold mb-2 ${g.tono}`}>{g.titulo}</h3>
                      <ul className="flex flex-col">
                        {g.lista.map((f) => {
                          const r = riesgoPorAlumno[f.alumno.id];
                          return (
                            <li key={f.alumno.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-rule last:border-b-0 text-[13.5px]">
                              <span className="min-w-0 truncate">{nombreFormal(f.alumno)}</span>
                              <span className={`shrink-0 tabular-nums font-bold text-[12.5px] px-1.5 py-0.5 rounded-md ${g.fondo} ${g.tono}`}>
                                {r.totalFaltas}/{faltasPermitidasSemestre}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
              </div>
            </details>
          )}

          <section className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
            {/* En móvil el calendario se pliega para no empujar la lista hacia abajo. */}
            <button
              onClick={() => setCalendarioAbierto((v) => !v)}
              aria-expanded={calendarioAbierto}
              className="sm:hidden flex items-center gap-3 bg-white border border-border rounded-card px-4 py-3 text-left"
            >
              <Icono nombre="calendario" className="w-5 h-5 text-goldDark" />
              <span className="flex-1 min-w-0">
                <span className="block text-[12px] text-inkSoft">Fecha</span>
                <span className="block font-bold truncate">{fechaLarga(fecha)}</span>
              </span>
              <span className="text-[13px] font-bold text-goldDark">{calendarioAbierto ? 'Cerrar' : 'Cambiar'}</span>
            </button>
            <div className={calendarioAbierto ? 'block' : 'hidden sm:block'}>
              <MiniCalendario fechaSeleccionada={fecha} onSeleccionar={cambiarFecha} diasConRegistro={diasConRegistro} />
            </div>

            <div className="flex-1 flex flex-col gap-3 min-w-0">
              <div className="bg-white border border-border rounded-card p-3">
                <div className="text-[12px] text-inkSoft font-bold mb-2 px-0.5">Hora de clase</div>
                <div role="radiogroup" aria-label="Hora de clase" className="grid grid-cols-2 gap-1 bg-bg rounded-[10px] p-1">
                  {([1, 2] as const).map((n) => (
                    <button
                      key={n}
                      role="radio"
                      aria-checked={clase === n}
                      onClick={() => cambiarClase(n)}
                      className={`min-h-[42px] rounded-[7px] text-[14px] font-bold transition-colors duration-150 ${
                        clase === n ? 'bg-navy text-white shadow-sm' : 'text-inkSoft hover:text-ink hover:bg-white/70'
                      }`}
                    >
                      Hora {n}
                    </button>
                  ))}
                </div>
                {clase === 2 && (
                  <>
                    <button
                      onClick={copiarDeHora1}
                      disabled={copiandoHora1 || cargando || cargado.clase !== 2}
                      className="mt-2 w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-[10px] border border-navy/20 bg-navy/[0.04] text-navy text-[14px] font-bold hover:bg-navy/[0.08] active:scale-[0.98] disabled:opacity-60"
                    >
                      <Icono nombre="copiar" />
                      {copiandoHora1 ? 'Copiando…' : 'Copiar asistencia de Hora 1'}
                    </button>
                    <p className={`mt-1.5 px-0.5 text-[12px] leading-snug ${copiadoHora1 && dirty ? 'text-green font-bold' : 'text-inkSoft'}`} aria-live="polite">
                      {copiadoHora1 && dirty
                        ? 'Copiado. Revisa la lista y pulsa Guardar.'
                        : 'Para 2 horas seguidas: repite asistencias, retardos, faltas y justificaciones.'}
                    </p>
                  </>
                )}

                <div className="mt-3 border-t border-rule pt-2">
                  <button
                    onClick={() => setSinClasesAbierto((v) => !v)}
                    aria-expanded={sinClasesAbierto}
                    className="w-full min-h-[40px] flex items-center justify-between gap-2 px-0.5 text-left text-[13.5px] font-bold text-goldDark"
                  >
                    ¿No hubo clases este día?
                    <Icono nombre="abajo" className={`w-4 h-4 transition-transform duration-200 motion-reduce:transition-none ${sinClasesAbierto ? 'rotate-180' : ''}`} />
                  </button>
                  {sinClasesAbierto && (
                    <div className="pt-1 pb-0.5">
                      <label className="flex flex-col gap-1 text-[12px] font-bold text-inkSoft px-0.5">
                        Motivo
                        <input
                          value={motivoSinClases}
                          onChange={(e) => {
                            setMotivoSinClases(e.target.value);
                            setDiaJustificado('');
                          }}
                          placeholder="Ej. Día inhábil por festejo de la Independencia"
                          maxLength={120}
                          className="w-full min-h-[44px] px-3 py-2 border border-border rounded-[10px] text-[16px] sm:text-sm font-normal text-ink bg-white"
                        />
                      </label>
                      <p className="mt-1.5 px-0.5 text-[12px] text-inkSoft leading-snug">
                        Todos los alumnos quedan con falta justificada y esa hora cuenta en su total de asistencias del parcial.
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {[
                          { horas: [cargado.clase] as (1 | 2)[], titulo: 'Justificar 1 hora', sub: `Hora ${cargado.clase}` },
                          { horas: [1, 2] as (1 | 2)[], titulo: 'Justificar 2 horas', sub: 'Horas 1 y 2' }
                        ].map((op) => (
                          <button
                            key={op.titulo}
                            onClick={() => justificarDiaSinClases(op.horas)}
                            disabled={!motivoSinClases.trim() || justificandoDia || guardando || cargando || cargado.clase !== clase || filas.length === 0}
                            className="min-h-[50px] flex flex-col items-center justify-center rounded-[10px] border border-green/40 bg-green/[0.06] text-green hover:bg-green/10 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                          >
                            <span className="text-[13.5px] font-bold leading-tight">{justificandoDia ? 'Justificando…' : op.titulo}</span>
                            <span className="text-[11.5px] leading-tight mt-0.5">{op.sub}</span>
                          </button>
                        ))}
                      </div>
                      {diaJustificado && (
                        <p role="status" className="mt-2 px-0.5 text-[12.5px] font-bold text-green leading-snug">
                          {diaJustificado}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-border rounded-card p-4 flex-1">
                <div className="grid grid-cols-3 divide-x divide-rule">
                  <Cifra label="Total" valor={resumen.total} detalle="alumnos" />
                  <Cifra
                    label="Presentes"
                    valor={resumen.presentes}
                    color="text-green"
                    detalle={<>{resumen.aTiempo} a tiempo · <span className="text-amber font-bold">{resumen.tardanzas} retardo{resumen.tardanzas === 1 ? '' : 's'}</span></>}
                  />
                  <Cifra label="Faltas" valor={resumen.ausentes} color="text-red" detalle={`${resumen.justificados} justificada${resumen.justificados === 1 ? '' : 's'}`} />
                </div>
                <div className="mt-4 flex h-2 rounded-full overflow-hidden bg-bg" aria-hidden="true">
                  <div className="bg-green transition-[width] duration-300" style={{ width: pct(resumen.aTiempo) }} />
                  <div className="bg-amber transition-[width] duration-300" style={{ width: pct(resumen.tardanzas) }} />
                  <div className="bg-red/70 transition-[width] duration-300" style={{ width: pct(resumen.ausentes) }} />
                </div>
              </div>
            </div>
          </section>

          {borradorRecuperado && (
            <div role="status" className="mb-4 flex items-start gap-3 bg-gold/15 border border-gold/45 rounded-card px-4 py-3 text-[14px] leading-snug">
              <Icono nombre="check" className="w-[18px] h-[18px] mt-0.5 text-goldDark" />
              <p className="flex-1">
                Recuperamos lo que marcaste y no se llegó a guardar. Revísalo y pulsa <b>Guardar</b>.
              </p>
              <button onClick={descartarCambios} className="text-[13px] font-bold text-goldDark underline underline-offset-2 shrink-0">
                Descartar
              </button>
            </div>
          )}

          <section className={`bg-white border border-border rounded-card transition-opacity ${cargando ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
              <h2 className="font-display text-[22px] font-semibold leading-none">
                Lista <span className="font-sans text-[13px] font-normal text-inkSoft">· {filas.length} alumnos</span>
              </h2>
              <button
                onClick={marcarTodosPresentes}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3 rounded-[10px] border border-green/40 bg-green/[0.06] text-green text-[13px] font-bold hover:bg-green/10 active:scale-[0.98]"
              >
                <Icono nombre="checkDoble" />
                Todos presentes
              </button>
            </div>

            <ol>
              {filas.map((f, i) => {
                const riesgo = riesgoPorAlumno[f.alumno.id];
                const atencion = enAtencion(f.alumno.id);
                const observacion = formatearObservacion(f.estatus, f.justificada, f.justificacionMotivo, f.justificacionDetalle);
                return (
                  <li key={f.alumno.id} className="flex border-b border-rule last:border-b-0">
                    <span className="w-10 md:w-12 shrink-0 pt-[15px] md:pt-0 md:self-center pr-2.5 text-right font-display text-[16px] text-inkSoft tabular-nums select-none">
                      {i + 1}
                    </span>
                    {/* Línea roja de margen, como en un cuaderno de registro. */}
                    <div className="flex-1 min-w-0 border-l-2 border-red/20 pl-3 pr-3 md:pr-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_auto_7.5rem] items-center gap-x-3 gap-y-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[15.5px] leading-snug">{f.alumno.nombre}</span>
                          {riesgo?.enRiesgo ? (
                            <span title="Faltas acumuladas / máximo permitido" className="tabular-nums text-[11.5px] font-bold px-1.5 py-0.5 rounded-md bg-red/10 text-red">
                              {riesgo.totalFaltas}/{faltasPermitidasSemestre}
                            </span>
                          ) : atencion ? (
                            <span title="Faltas acumuladas / máximo permitido" className="tabular-nums text-[11.5px] font-bold px-1.5 py-0.5 rounded-md bg-amber/10 text-amber">
                              {riesgo.totalFaltas}/{faltasPermitidasSemestre}
                            </span>
                          ) : null}
                        </div>
                        {observacion && (
                          <p className="text-[12.5px] text-leafDark mt-0.5 truncate" title={observacion}>
                            Justificada: {observacion}
                          </p>
                        )}
                      </div>
                      <div className="md:order-last justify-self-end">
                        {f.estatus === 'falto' && (
                          <JustificarPopover
                            justificada={f.justificada}
                            motivo={f.justificacionMotivo}
                            detalle={f.justificacionDetalle}
                            abierto={justificandoId === f.alumno.id}
                            onAbrir={() => setJustificandoId(f.alumno.id)}
                            onCerrar={() => setJustificandoId(null)}
                            onGuardar={(motivo, detalle) => guardarJustificacion(f.alumno.id, motivo, detalle)}
                            onQuitar={() => { quitarJustificacion(f.alumno.id); setJustificandoId(null); }}
                          />
                        )}
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <StatusPillGroup value={f.estatus} onChange={(v) => cambiarEstatus(f.alumno.id, v)} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            {filas.length === 0 && (
              <div className="px-4 py-8 text-sm text-inkSoft text-center">
                Este grupo no tiene alumnos todavía. Ve a "Alumnos" para agregarlos.
              </div>
            )}
          </section>

          <div className="mt-6">
            <AttendanceHeatmap dias={diasHeatmap} />
          </div>

          <div className="mt-6">
            <AiSummaryButton grupoId={grupoId} />
          </div>
        </div>
      </div>

      {/* Barra de guardado siempre a mano: antes el botón estaba solo arriba y
          había que subir toda la lista para guardar. */}
      <footer className="shrink-0 border-t border-border bg-white px-4 md:px-8 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_-12px_rgba(16,27,52,0.25)]">
        <div className="max-w-[920px] mx-auto">
          {errorSync && (
            <div role="alert" className="mb-2.5 flex items-start gap-2 bg-red/10 border border-red/30 rounded-[10px] px-3 py-2 text-[13px] text-red leading-snug">
              <Icono nombre="alerta" className="w-4 h-4 mt-0.5" />
              <span className="flex-1">{errorSync}</span>
              <button onClick={() => setErrorSync('')} aria-label="Cerrar aviso" className="shrink-0 -m-1 p-1">
                <Icono nombre="cerrar" className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0" aria-live="polite">
              <div className={`flex items-center gap-1.5 text-[14px] font-bold ${estado.tono}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${estado.punto}`} />
                <span className="truncate">{estado.texto}</span>
              </div>
              <div className="text-[12.5px] text-inkSoft truncate tabular-nums">
                {formatearFecha(cargado.fecha).slice(0, 5)} · Hora {cargado.clase} · {resumen.presentes}/{resumen.total} presentes
              </div>
            </div>

            <div className="relative flex shrink-0">
              <button
                onClick={() => guardar()}
                disabled={guardando || cargando || justificandoDia}
                className="min-h-[46px] inline-flex items-center gap-2 pl-4 pr-3.5 rounded-l-[12px] bg-navy text-white text-[15px] font-bold disabled:opacity-60 hover:bg-navyActive active:scale-[0.98] transition"
              >
                <Icono nombre="nubeSubir" className="w-[18px] h-[18px] text-gold" />
                {guardando ? 'Guardando…' : (
                  <>
                    <span className="sm:hidden">Guardar</span>
                    <span className="hidden sm:inline">Guardar asistencia</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setMenuGuardarAbierto((v) => !v)}
                disabled={guardando || cargando}
                aria-label="Más opciones de guardado"
                aria-expanded={menuGuardarAbierto}
                aria-haspopup="menu"
                className="min-h-[46px] px-2.5 rounded-r-[12px] bg-navy text-white border-l border-white/15 disabled:opacity-60 hover:bg-navyActive"
              >
                <Icono nombre="arriba" className={`w-[18px] h-[18px] transition-transform ${menuGuardarAbierto ? 'rotate-180' : ''}`} />
              </button>

              {menuGuardarAbierto && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuGuardarAbierto(false)} aria-hidden="true" />
                  <div role="menu" className="absolute right-0 bottom-full mb-2 z-40 w-72 max-w-[calc(100vw-2rem)] bg-white border border-border rounded-card shadow-xl shadow-navy/15 p-1.5">
                    {[
                      { icono: 'carpetaAbierta' as const, texto: 'Guardar en otra carpeta de Drive…', accion: () => { setMenuGuardarAbierto(false); setModalCarpetaAbierto(true); } },
                      { icono: 'descargar' as const, texto: 'Descargar Excel', accion: exportarExcel },
                      { icono: 'descargar' as const, texto: 'Descargar PDF', accion: exportarPDF }
                    ].map((op) => (
                      <button
                        key={op.texto}
                        role="menuitem"
                        onClick={op.accion}
                        className="w-full flex items-center gap-3 text-left px-3 min-h-[44px] rounded-[8px] text-[14px] hover:bg-bg"
                      >
                        <Icono nombre={op.icono} className="w-[18px] h-[18px] text-inkSoft" />
                        {op.texto}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </footer>

      <SeleccionarCarpetaDriveModal
        abierto={modalCarpetaAbierto}
        onCerrar={() => setModalCarpetaAbierto(false)}
        onConfirmar={(carpetaId) => {
          setModalCarpetaAbierto(false);
          guardar(carpetaId);
        }}
      />
    </div>
  );
}
