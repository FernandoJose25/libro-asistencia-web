'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { formatearNota, redondearDecima, type Parcial } from '@/lib/calificaciones';
import { Icono } from './Icono';

export interface FilaAnalisis {
  nombre: string;
  entregadas: number;
  examen: number | null;
  calificacion: number | null;
}

interface Punto {
  nombre: string;
  x: number;
  y: number;
}

type Resultado = { r: number; pendiente: number; intercepto: number } | { motivo: string };

// Correlación de Pearson (de −1 a 1) y la recta de tendencia. Sin resultado si
// hay menos de 3 alumnos o si un valor es igual para todos.
function analizar(puntos: Punto[], sinVariacionX: string): Resultado {
  const n = puntos.length;
  if (n < 3) return { motivo: 'Hacen falta al menos 3 alumnos con calificación para calcularla.' };
  const mx = puntos.reduce((s, p) => s + p.x, 0) / n;
  const my = puntos.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  puntos.forEach((p) => {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
  });
  if (sxx < 1e-9) return { motivo: sinVariacionX };
  if (syy < 1e-9) return { motivo: 'Todos tienen la misma calificación del parcial: no hay diferencias que comparar.' };
  const pendiente = sxy / sxx;
  return { r: sxy / Math.sqrt(sxx * syy), pendiente, intercepto: my - pendiente * mx };
}

function fuerza(r: number) {
  const a = Math.abs(r);
  if (a >= 0.7) return 'fuerte';
  if (a >= 0.4) return 'moderada';
  if (a >= 0.2) return 'débil';
  return null;
}

const formatearR = (r: number) => (r < 0 ? '−' : '') + Math.abs(r).toFixed(2);

export function AnalisisCorrelacion({
  parcial,
  porcentajeTrabajos,
  totalTrabajos,
  filas,
  onCerrar
}: {
  parcial: Parcial;
  porcentajeTrabajos: number;
  totalTrabajos: number;
  filas: FilaAnalisis[];
  onCerrar: () => void;
}) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const conCalificacion = filas.filter((f) => f.calificacion !== null);
  const puntosTareas = totalTrabajos ? conCalificacion.map((f) => ({ nombre: f.nombre, x: f.entregadas, y: f.calificacion! })) : [];
  const puntosExamen = conCalificacion
    .filter((f) => f.examen !== null)
    .map((f) => ({ nombre: f.nombre, x: f.examen!, y: f.calificacion! }));
  const pasoTareas = totalTrabajos <= 10 ? 1 : totalTrabajos <= 20 ? 2 : 5;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-stretch md:items-center justify-center md:p-6"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-analisis"
        className="bg-bg w-full md:max-w-[760px] md:max-h-full md:rounded-xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 md:px-6 pt-4 pb-3 border-b border-border bg-white md:rounded-t-xl">
          <div>
            <p className="text-[11.5px] uppercase tracking-[0.16em] font-bold text-goldDark">Análisis del parcial {parcial}</p>
            <h2 id="titulo-analisis" className="font-display text-[24px] md:text-[28px] font-semibold leading-tight mt-0.5">
              ¿Qué va de la mano con la calificación?
            </h2>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar análisis"
            className="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-md border border-border hover:bg-bg"
          >
            <Icono nombre="cerrar" className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 md:px-6 py-4 space-y-4">
          <TarjetaCorrelacion
            titulo="Tareas entregadas y calificación del parcial"
            puntos={puntosTareas}
            vacio="Este parcial aún no tiene trabajos."
            sinVariacionX="Todos entregaron la misma cantidad de tareas: no hay diferencias que comparar."
            xMax={Math.max(1, totalTrabajos)}
            pasoX={pasoTareas}
            etiquetaX={`Tareas entregadas (de ${totalTrabajos})`}
            formatoX={(x) => `${x} de ${totalTrabajos} tareas`}
            queSube="más tareas entregadas"
            eje="Las tareas entregadas"
            nota={
              porcentajeTrabajos > 0
                ? `Los trabajos son el ${porcentajeTrabajos}% de la calificación y cada tarea sin entregar cuenta como 0: es de esperar que vayan de la mano.`
                : 'Este grupo califica solo con el examen: las tareas no cuentan en la calificación.'
            }
          />
          <TarjetaCorrelacion
            titulo="Examen y calificación del parcial"
            puntos={puntosExamen}
            vacio="Todavía no hay exámenes calificados en este parcial."
            sinVariacionX="Todos sacaron lo mismo en el examen: no hay diferencias que comparar."
            xMax={10}
            pasoX={2}
            etiquetaX="Examen"
            formatoX={(x) => `Examen: ${formatearNota(x)}`}
            queSube="mejor examen"
            eje="El examen"
            nota={
              porcentajeTrabajos < 100
                ? `El examen es el ${100 - porcentajeTrabajos}% de la calificación: es de esperar que vayan de la mano.`
                : 'Este grupo califica solo con trabajos: el examen no cuenta en la calificación.'
            }
          />
          <p className="text-[11.5px] text-inkSoft">
            Solo entran los alumnos con calificación del parcial. Cuenta como entregada la tarea con nota (NE y — no cuentan). La
            correlación va de −1 a 1: cerca de 1, cuando uno sube el otro también; cerca de 0, no van de la mano.
          </p>
        </div>
      </div>
    </div>
  );
}

function TarjetaCorrelacion({
  titulo,
  puntos,
  vacio,
  sinVariacionX,
  xMax,
  pasoX,
  etiquetaX,
  formatoX,
  queSube,
  eje,
  nota
}: {
  titulo: string;
  puntos: Punto[];
  vacio: string;
  sinVariacionX: string;
  xMax: number;
  pasoX: number;
  etiquetaX: string;
  formatoX: (x: number) => string;
  queSube: string;
  eje: string;
  nota: string;
}) {
  const resultado = analizar(puntos, sinVariacionX);
  const conR = 'r' in resultado ? resultado : null;
  const f = conR && fuerza(conR.r);

  return (
    <section className="bg-white border border-border rounded-card px-4 py-3.5">
      <h3 className="font-display text-[19px] font-semibold leading-snug">{titulo}</h3>

      {puntos.length === 0 ? (
        <p className="text-[13px] text-inkSoft py-6 text-center">{vacio}</p>
      ) : (
        <>
          {conR ? (
            <div className="flex items-center gap-4 mt-2.5">
              <div className="text-center shrink-0">
                <div className="font-display text-[34px] leading-none font-semibold tabular-nums text-navy">{formatearR(conR.r)}</div>
                <div className="text-[10.5px] uppercase tracking-wide text-inkSoft mt-1">Correlación</div>
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-bold">
                  {f ? `Relación ${f}${conR.r < 0 ? ' e inversa' : ''}` : 'Casi sin relación'}
                </div>
                <div className="text-[13px] text-inkSoft leading-snug">
                  {f
                    ? `En general, a ${queSube}, ${conR.r > 0 ? 'mejor' : 'peor'} calificación del parcial.`
                    : `${eje} y la calificación del parcial casi no van de la mano.`}
                </div>
              </div>
            </div>
          ) : (
            'motivo' in resultado && <p className="text-[13px] text-amber mt-2">{resultado.motivo}</p>
          )}

          <Dispersion
            puntos={puntos}
            xMax={xMax}
            pasoX={pasoX}
            etiquetaX={etiquetaX}
            formatoX={formatoX}
            recta={conR}
          />

          <p className="text-[12px] text-inkSoft mt-1">{nota}</p>

          <details className="mt-2 text-[13px]">
            <summary className="cursor-pointer font-semibold text-goldDark py-1">Ver datos por alumno ({puntos.length})</summary>
            <ol className="mt-1 divide-y divide-rule">
              {[...puntos]
                .sort((a, b) => b.y - a.y)
                .map((p, i) => (
                  <li key={i} className="flex justify-between gap-3 py-1.5">
                    <span className="min-w-0">{p.nombre}</span>
                    <span className="shrink-0 tabular-nums text-inkSoft">
                      {formatoX(p.x)} · <b className="text-ink">{formatearNota(p.y)}</b>
                    </span>
                  </li>
                ))}
            </ol>
          </details>
        </>
      )}
    </section>
  );
}

const ALTO = 250;
const MARGEN = { izq: 30, der: 10, arr: 10, aba: 38 };
const RELLENO = 10; // separa los puntos de los bordes del área

// Diagrama de dispersión: un punto por alumno (los que comparten los mismos dos
// valores van juntos, en un punto más grande con su cantidad). Tocar un punto
// muestra quiénes son.
function Dispersion({
  puntos,
  xMax,
  pasoX,
  etiquetaX,
  formatoX,
  recta
}: {
  puntos: Punto[];
  xMax: number;
  pasoX: number;
  etiquetaX: string;
  formatoX: (x: number) => string;
  recta: { pendiente: number; intercepto: number } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  const [activo, setActivo] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const izq = MARGEN.izq + RELLENO;
  const der = ancho - MARGEN.der - RELLENO;
  const arr = MARGEN.arr + RELLENO;
  const aba = ALTO - MARGEN.aba - RELLENO;
  const sx = (x: number) => izq + (x / xMax) * (der - izq);
  const sy = (y: number) => aba - (y / 10) * (aba - arr);

  const grupos = new Map<string, { x: number; y: number; nombres: string[] }>();
  puntos.forEach((p) => {
    const clave = `${p.x}|${redondearDecima(p.y)}`;
    const g = grupos.get(clave);
    if (g) g.nombres.push(p.nombre);
    else grupos.set(clave, { x: p.x, y: p.y, nombres: [p.nombre] });
  });
  const lista = [...grupos.values()];
  const radio = (n: number) => 5 + Math.min(n - 1, 4) * 1.5;

  const ticksX: number[] = [];
  for (let x = 0; x <= xMax; x += pasoX) ticksX.push(x);

  let linea: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (recta) {
    // Recta dentro del rango de los datos y sin salirse de 0–10.
    const xs = puntos.map((p) => p.x);
    let x1 = Math.min(...xs);
    let x2 = Math.max(...xs);
    const { pendiente: b, intercepto: a } = recta;
    if (b !== 0) {
      const enCero = -a / b;
      const enDiez = (10 - a) / b;
      x1 = Math.max(x1, Math.min(enCero, enDiez));
      x2 = Math.min(x2, Math.max(enCero, enDiez));
    }
    linea = { x1: sx(x1), y1: sy(a + b * x1), x2: sx(x2), y2: sy(a + b * x2) };
  }

  function elegir(e: PointerEvent<SVGSVGElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - caja.left;
    const py = e.clientY - caja.top;
    let mejor: number | null = null;
    let distancia = 26 * 26; // zona de toque mucho mayor que el punto
    lista.forEach((g, i) => {
      const d = (sx(g.x) - px) ** 2 + (sy(g.y) - py) ** 2;
      if (d < distancia) {
        distancia = d;
        mejor = i;
      }
    });
    setActivo(mejor);
  }

  const elegido = activo !== null ? lista[activo] : null;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2 text-[11.5px] font-bold text-inkSoft">
        <span>Calificación</span>
        {linea && (
          <span className="inline-flex items-center gap-1.5 font-normal">
            <span className="inline-block w-4 h-[2.5px] rounded bg-gold" />
            Tendencia
          </span>
        )}
      </div>
    <div ref={ref} className="relative" style={{ height: ALTO }}>
      {ancho > 0 && (
        <svg
          width={ancho}
          height={ALTO}
          role="img"
          aria-label={`Diagrama de dispersión: ${etiquetaX} contra calificación del parcial, ${puntos.length} alumnos.`}
          className="block overflow-visible select-none"
          onPointerDown={elegir}
          onPointerMove={(e) => e.pointerType === 'mouse' && elegir(e)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActivo(null)}
        >
          {[0, 2, 4, 6, 8, 10].map((y) => (
            <g key={y}>
              <line x1={MARGEN.izq} x2={ancho - MARGEN.der} y1={sy(y)} y2={sy(y)} stroke="#ece5d6" strokeWidth={1} />
              <text x={MARGEN.izq - 6} y={sy(y)} dy="0.32em" textAnchor="end" fontSize={11} fill="#5f6573">
                {y}
              </text>
            </g>
          ))}
          <line x1={MARGEN.izq} x2={ancho - MARGEN.der} y1={ALTO - MARGEN.aba} y2={ALTO - MARGEN.aba} stroke="#e4dccb" strokeWidth={1} />
          {ticksX.map((x) => (
            <text key={x} x={sx(x)} y={ALTO - MARGEN.aba + 15} textAnchor="middle" fontSize={11} fill="#5f6573">
              {x}
            </text>
          ))}
          <text x={(izq + der) / 2} y={ALTO - 4} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="#5f6573">
            {etiquetaX}
          </text>

          {linea && (
            <line {...linea} stroke="#d6a72f" strokeWidth={2.5} strokeLinecap="round" />
          )}

          {lista.map((g, i) => {
            const r = radio(g.nombres.length);
            return (
              <g key={i}>
                <circle
                  cx={sx(g.x)}
                  cy={sy(g.y)}
                  r={r}
                  fill={i === activo ? '#1f3260' : '#101b34'}
                  fillOpacity={i === activo ? 1 : 0.82}
                  stroke={i === activo ? '#d6a72f' : '#ffffff'}
                  strokeWidth={2}
                />
                {g.nombres.length > 1 && (
                  <text x={sx(g.x)} y={sy(g.y)} dy="0.34em" textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#ffffff" pointerEvents="none">
                    {g.nombres.length}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}

      {elegido && (
        <div
          className="absolute z-10 w-[190px] bg-navy text-white rounded-lg px-3 py-2 text-[12.5px] leading-snug shadow-lg pointer-events-none"
          style={{
            left: Math.min(Math.max(sx(elegido.x) - 95, 0), ancho - 190),
            top: sy(elegido.y) < 110 ? sy(elegido.y) + 16 : sy(elegido.y) - 16,
            transform: sy(elegido.y) < 110 ? undefined : 'translateY(-100%)'
          }}
        >
          <div className="font-bold">
            {elegido.nombres.slice(0, 5).join(' · ')}
            {elegido.nombres.length > 5 && ` y ${elegido.nombres.length - 5} más`}
          </div>
          <div className="text-white/80 mt-0.5">
            {formatoX(elegido.x)} · Calificación {formatearNota(elegido.y)}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
