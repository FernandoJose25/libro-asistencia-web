'use client';

import { useEffect, useRef, useState } from 'react';

// Profesor del login: SVG en capas (cabeza, ojos, párpados, cejas, boca,
// brazos, libro) para animar cada parte por separado.
//  - Las pupilas siguen el puntero, el dedo, o el cursor del campo enfocado.
//  - Con la contraseña oculta se tapa los ojos con el libro de asistencia;
//    si se muestra la contraseña, baja el libro y espía por encima.
//  - Mientras se escribe el correo "toma nota" con el lápiz.
//  - Parpadea solo, respira, niega con la cabeza al fallar y salta al entrar.
export type EstadoProfesor = 'reposo' | 'escribiendo' | 'tapado' | 'espiando' | 'pensando' | 'error' | 'exito';

interface Punto {
  x: number;
  y: number;
}

interface Pose {
  manoI: Punto;
  manoD: Punto;
  libro: Punto & { giro: number };
}

const ANCHO = 320;
const ALTO = 400;
const HOMBRO_I = { x: 118, y: 162 };
const HOMBRO_D = { x: 202, y: 162 };
const LARGO_BRAZO = 86;
const OJOS = { I: { x: 147, y: 99 }, D: { x: 173, y: 99 } };
const PARPADO_CERRADO = 19;

const REPOSO: Pose = { manoI: { x: 126, y: 240 }, manoD: { x: 194, y: 240 }, libro: { x: 160, y: 236, giro: 0 } };

const POSES: Record<EstadoProfesor, Pose> = {
  reposo: REPOSO,
  escribiendo: { manoI: { x: 116, y: 238 }, manoD: { x: 176, y: 226 }, libro: { x: 150, y: 232, giro: -10 } },
  tapado: { manoI: { x: 121, y: 102 }, manoD: { x: 199, y: 102 }, libro: { x: 160, y: 98, giro: 0 } },
  espiando: { manoI: { x: 121, y: 142 }, manoD: { x: 199, y: 142 }, libro: { x: 160, y: 140, giro: 0 } },
  pensando: { manoI: { x: 120, y: 238 }, manoD: { x: 170, y: 142 }, libro: { x: 136, y: 236, giro: -6 } },
  error: REPOSO,
  exito: { manoI: { x: 120, y: 238 }, manoD: { x: 234, y: 116 }, libro: { x: 136, y: 236, giro: -6 } }
};

type Animo = 'normal' | 'alegre' | 'triste' | 'concentrado' | 'picaro';

const ANIMO: Record<EstadoProfesor, Animo> = {
  reposo: 'normal',
  escribiendo: 'concentrado',
  tapado: 'alegre',
  espiando: 'picaro',
  pensando: 'picaro',
  error: 'triste',
  exito: 'alegre'
};

const CEJAS: Record<Animo, [string, string]> = {
  normal: ['M139 85 L155 83', 'M165 83 L181 85'],
  alegre: ['M139 83 Q147 78 155 82', 'M165 82 Q173 78 181 83'],
  triste: ['M139 87 L155 81', 'M165 81 L181 87'],
  concentrado: ['M139 83 L155 87', 'M165 87 L181 83'],
  picaro: ['M139 85 L155 85', 'M165 81 Q173 76 181 80']
};

const BOCAS: Record<Animo, string> = {
  normal: 'M151 123 Q160 128 169 123',
  alegre: 'M148 121 Q160 136 172 121 Z',
  triste: 'M151 127 Q160 121 169 127',
  concentrado: 'M154 125 L166 124',
  picaro: 'M151 124 Q163 128 171 119'
};

const mezclar = (a: number, b: number, t: number) => a + (b - a) * t;
const mezclarPunto = (a: Punto, b: Punto, t: number) => ({ x: mezclar(a.x, b.x, t), y: mezclar(a.y, b.y, t) });

// Brazo como curva hombro → mano; el codo se dobla hacia afuera cuanto más
// cerca queda la mano del hombro (un brazo estirado va recto).
function trazoBrazo(hombro: Punto, mano: Punto, lado: -1 | 1) {
  const dx = mano.x - hombro.x;
  const dy = mano.y - hombro.y;
  const d = Math.hypot(dx, dy) || 1;
  let px = -dy / d;
  let py = dx / d;
  if (Math.sign(px) !== lado && px !== 0) {
    px = -px;
    py = -py;
  }
  const doblez = Math.max(0, LARGO_BRAZO - d) * 0.65;
  const cx = (hombro.x + mano.x) / 2 + px * doblez;
  const cy = (hombro.y + mano.y) / 2 + py * doblez;
  return `M${hombro.x} ${hombro.y} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${mano.x.toFixed(1)} ${mano.y.toFixed(1)}`;
}

export function ProfesorMascota({
  estado,
  objetivo,
  className = ''
}: {
  estado: EstadoProfesor;
  // Punto de la pantalla (clientX/clientY) al que mirar, p. ej. el cursor del
  // campo enfocado. Si es null, mira al puntero o al último toque.
  objetivo: Punto | null;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pupilaI = useRef<SVGGElement>(null);
  const pupilaD = useRef<SVGGElement>(null);
  const parpadoI = useRef<SVGRectElement>(null);
  const parpadoD = useRef<SVGRectElement>(null);
  const estadoRef = useRef(estado);
  const objetivoRef = useRef(objetivo);
  const [pose, setPose] = useState<Pose>(REPOSO);
  const poseRef = useRef<Pose>(REPOSO);
  const [garabato, setGarabato] = useState<Punto>({ x: 0, y: 0 });

  estadoRef.current = estado;
  objetivoRef.current = objetivo;

  const ojosOcultos = () => estadoRef.current === 'tapado';

  function mirar(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * ANCHO;
    const vy = ((clientY - r.top) / r.height) * ALTO;
    ([['I', pupilaI.current], ['D', pupilaD.current]] as const).forEach(([lado, el]) => {
      if (!el) return;
      const c = OJOS[lado];
      const dx = vx - c.x;
      const dy = vy - c.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(3.2, d / 10) / d;
      el.setAttribute('transform', `translate(${(dx * k).toFixed(2)} ${(dy * k).toFixed(2)})`);
    });
  }

  function centrarPupilas() {
    pupilaI.current?.setAttribute('transform', 'translate(0 0)');
    pupilaD.current?.setAttribute('transform', 'translate(0 0)');
  }

  function moverParpados(hasta: number, duracion: number) {
    const desde = parseFloat(parpadoI.current?.getAttribute('height') || '0') || 0;
    const t0 = performance.now();
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - t0) / duracion);
      const h = String(desde + (hasta - desde) * t);
      parpadoI.current?.setAttribute('height', h);
      parpadoD.current?.setAttribute('height', h);
      if (t < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  // Puntero (mouse) y toques (móvil, donde no hay cursor).
  useEffect(() => {
    const alMover = (e: PointerEvent) => {
      if (objetivoRef.current || ojosOcultos()) return;
      mirar(e.clientX, e.clientY);
    };
    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerdown', alMover);
    return () => {
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerdown', alMover);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ojosOcultos()) centrarPupilas();
    else if (objetivo) mirar(objetivo.x, objetivo.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objetivo, estado]);

  // Parpadeo periódico, con un intervalo algo irregular para que no sea mecánico.
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const programar = () => {
      id = setTimeout(() => {
        if (!ojosOcultos()) {
          moverParpados(PARPADO_CERRADO, 80);
          setTimeout(() => moverParpados(0, 110), 140);
        }
        programar();
      }, 2600 + Math.random() * 2600);
    };
    programar();
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Transición suave entre poses (brazos y libro).
  useEffect(() => {
    const desde = poseRef.current;
    const hacia = POSES[estado];
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duracion = reducido ? 1 : estado === 'tapado' ? 360 : 460;
    const t0 = performance.now();
    let raf = 0;
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - t0) / duracion);
      const e = 1 - Math.pow(1 - t, 3);
      const p: Pose = {
        manoI: mezclarPunto(desde.manoI, hacia.manoI, e),
        manoD: mezclarPunto(desde.manoD, hacia.manoD, e),
        libro: { ...mezclarPunto(desde.libro, hacia.libro, e), giro: mezclar(desde.libro.giro, hacia.libro.giro, e) }
      };
      poseRef.current = p;
      setPose(p);
      if (t < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [estado]);

  // Lápiz garabateando mientras se escribe el correo.
  useEffect(() => {
    if (estado !== 'escribiendo' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setGarabato({ x: 0, y: 0 });
      return;
    }
    let raf = 0;
    const paso = (ahora: number) => {
      setGarabato({ x: Math.sin(ahora * 0.016) * 7, y: Math.sin(ahora * 0.034) * 2.5 });
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [estado]);

  const animo = ANIMO[estado];
  const [cejaI, cejaD] = CEJAS[animo];
  const bocaRellena = animo === 'alegre';
  const sonrojo = estado === 'tapado' || estado === 'espiando' || estado === 'exito';
  const manoD = { x: pose.manoD.x + garabato.x, y: pose.manoD.y + garabato.y };
  const { libro } = pose;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className={`prof-svg ${className}`}
      role="img"
      aria-label="Profesor animado que acompaña el inicio de sesión"
    >
      <ellipse className="prof-sombra" cx="160" cy="392" rx="78" ry="9" fill="#101b34" opacity="0.12" />

      <g className={estado === 'exito' ? 'prof-saltar' : ''}>
        <g className="prof-respirar">
          {/* Piernas y zapatos */}
          <rect x="134" y="318" width="22" height="64" fill="#1d2740" />
          <rect x="164" y="318" width="22" height="64" fill="#1d2740" />
          <rect x="126" y="378" width="34" height="12" rx="6" fill="#0d121c" />
          <rect x="160" y="378" width="34" height="12" rx="6" fill="#0d121c" />

          {/* Cuello */}
          <rect x="151" y="126" width="18" height="30" fill="#e3b089" />

          {/* Bata */}
          <path
            d="M112 170 Q114 152 132 150 L188 150 Q206 152 208 170 L214 212 L218 334 L102 334 L106 212 Z"
            fill="#fbfaf5"
            stroke="#1c2230"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M206 214 L212 332 L196 332 Z" fill="#e9e3d6" />
          <path d="M160 194 L160 334" stroke="#1c2230" strokeWidth="2" />
          <path d="M146 150 L174 150 L160 192 Z" fill="#ffffff" stroke="#1c2230" strokeWidth="2" strokeLinejoin="round" />
          <path d="M155 152 L165 152 L163 161 L157 161 Z" fill="#8f2637" />
          <path d="M157 161 L163 161 L167 196 L160 205 L153 196 Z" fill="#b23346" />
          <path d="M146 150 L160 192 L147 206 L131 158 Z" fill="#efe9dc" stroke="#1c2230" strokeWidth="2" strokeLinejoin="round" />
          <path d="M174 150 L160 192 L173 206 L189 158 Z" fill="#efe9dc" stroke="#1c2230" strokeWidth="2" strokeLinejoin="round" />
          {/* Bolsillo con lapiceros */}
          <path d="M183 202 L183 216" stroke="#d6a72f" strokeWidth="3" strokeLinecap="round" />
          <path d="M189 204 L189 216" stroke="#1f3260" strokeWidth="3" strokeLinecap="round" />
          <path d="M178 216 L198 216" stroke="#1c2230" strokeWidth="2" strokeLinecap="round" />
          <circle cx="167" cy="240" r="2.2" fill="#c9c1af" />
          <circle cx="167" cy="266" r="2.2" fill="#c9c1af" />
          <circle cx="167" cy="292" r="2.2" fill="#c9c1af" />
          <path d="M116 290 L138 290 M182 290 L204 290" stroke="#1c2230" strokeWidth="2" strokeLinecap="round" />

          {/* Cabeza */}
          <g className={estado === 'error' ? 'prof-negar' : ''}>
            <path d="M124 92 Q113 94 115 105 Q117 113 126 111 Z" fill="#f1c9a0" stroke="#1c2230" strokeWidth="2" />
            <path d="M196 92 Q207 94 205 105 Q203 113 194 111 Z" fill="#f1c9a0" stroke="#1c2230" strokeWidth="2" />
            <path
              d="M126 66 L194 66 L198 102 L192 122 L174 137 L146 137 L128 122 L122 102 Z"
              fill="#f1c9a0"
              stroke="#1c2230"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path d="M128 122 L146 137 L152 137 L134 120 Z" fill="#e3b089" />

            {/* Pelo con raya al costado y sienes canosas */}
            <path
              d="M120 90 L121 62 Q127 38 156 33 Q188 30 198 50 L201 66 L200 90 L195 72 Q187 62 168 62 L149 57 Q138 66 128 67 L126 90 Z"
              fill="#1c2230"
            />
            <path d="M149 57 Q172 40 197 55 Q178 50 163 61 Z" fill="#323b52" />
            <path d="M121 74 L126 74 L126 90 L120 89 Z" fill="#a3a9b5" />
            <path d="M199 74 L194 74 L194 90 L200 89 Z" fill="#a3a9b5" />

            {/* Ojos */}
            <ellipse cx={OJOS.I.x} cy={OJOS.I.y} rx="7.5" ry="8" fill="#ffffff" />
            <ellipse cx={OJOS.D.x} cy={OJOS.D.y} rx="7.5" ry="8" fill="#ffffff" />
            <g ref={pupilaI}>
              <circle cx={OJOS.I.x} cy={OJOS.I.y} r="3.7" fill="#1c2230" />
              <circle cx={OJOS.I.x - 1.2} cy={OJOS.I.y - 1.3} r="1.2" fill="#ffffff" />
            </g>
            <g ref={pupilaD}>
              <circle cx={OJOS.D.x} cy={OJOS.D.y} r="3.7" fill="#1c2230" />
              <circle cx={OJOS.D.x - 1.2} cy={OJOS.D.y - 1.3} r="1.2" fill="#ffffff" />
            </g>
            <rect ref={parpadoI} x="139" y="90" width="16" height="0" fill="#f1c9a0" />
            <rect ref={parpadoD} x="165" y="90" width="16" height="0" fill="#f1c9a0" />

            {/* Lentes */}
            <g fill="rgba(255,255,255,0.14)" stroke="#1c2230" strokeWidth="2.5">
              <rect x="135" y="89" width="24" height="20" rx="6" />
              <rect x="161" y="89" width="24" height="20" rx="6" />
              <path d="M159 97 Q160 95 161 97" fill="none" />
              <path d="M135 95 L124 93 M185 95 L196 93" fill="none" strokeLinecap="round" />
            </g>

            <path d={cejaI} stroke="#1c2230" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            <path d={cejaD} stroke="#1c2230" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            <path d="M160 101 L155 115 L162 115" stroke="#b98a66" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" fill="none" />
            <path
              d={BOCAS[animo]}
              stroke="#7a2f2f"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={bocaRellena ? '#7a2f2f' : 'none'}
             
            />
            <g className="prof-sonrojo" style={{ opacity: sonrojo ? 1 : 0 }}>
              <ellipse cx="136" cy="116" rx="7" ry="4" fill="#e98c7a" opacity="0.6" />
              <ellipse cx="184" cy="116" rx="7" ry="4" fill="#e98c7a" opacity="0.6" />
            </g>
          </g>

          {/* Libro de asistencia */}
          <g transform={`translate(${libro.x.toFixed(1)} ${libro.y.toFixed(1)}) rotate(${libro.giro.toFixed(1)})`}>
            <rect x="-40" y="-28" width="80" height="56" rx="4" fill="#101b34" stroke="#0a1224" strokeWidth="2" />
            <rect x="-40" y="-28" width="10" height="56" rx="3" fill="#1f3260" />
            <rect x="-21" y="-15" width="52" height="24" rx="2" fill="none" stroke="#d6a72f" strokeWidth="1.5" />
            <path d="M-15 -7 H25 M-15 1 H13" stroke="#d6a72f" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M-29 25 H38" stroke="#f5f1e8" strokeWidth="2" />
          </g>

          {/* Brazos (mangas de la bata) y manos */}
          {([
            [HOMBRO_I, pose.manoI, -1],
            [HOMBRO_D, manoD, 1]
          ] as const).map(([hombro, mano, lado]) => {
            const d = trazoBrazo(hombro, mano, lado);
            return (
              <g key={lado}>
                <path d={d} stroke="#1c2230" strokeWidth="21" strokeLinecap="round" fill="none" />
                <path d={d} stroke="#fbfaf5" strokeWidth="16.5" strokeLinecap="round" fill="none" />
              </g>
            );
          })}
          <circle cx={pose.manoI.x} cy={pose.manoI.y} r="8.5" fill="#f1c9a0" stroke="#1c2230" strokeWidth="2" />
          <g>
            <path
              d={`M${manoD.x + 2} ${manoD.y - 2} L${manoD.x + 13} ${manoD.y - 18}`}
              stroke="#1f3260"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle cx={manoD.x + 13} cy={manoD.y - 18} r="1.8" fill="#d6a72f" />
            <circle cx={manoD.x} cy={manoD.y} r="8.5" fill="#f1c9a0" stroke="#1c2230" strokeWidth="2" />
          </g>
        </g>
      </g>

      <style>{`
        .prof-svg { overflow: visible; }
        .prof-respirar { animation: prof-respirar 3.8s ease-in-out infinite; }
        @keyframes prof-respirar { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .prof-sombra { animation: prof-sombra 3.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes prof-sombra { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(0.94); } }
        .prof-negar { animation: prof-negar 0.6s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes prof-negar {
          10%, 90% { transform: translateX(-2px); } 20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-6px); } 40%, 60% { transform: translateX(6px); }
        }
        .prof-saltar { animation: prof-saltar 0.7s cubic-bezier(.22,1,.36,1) both; }
        @keyframes prof-saltar { 0% { transform: translateY(0); } 35% { transform: translateY(-18px); } 65% { transform: translateY(0); } 80% { transform: translateY(-5px); } 100% { transform: translateY(0); } }
        .prof-sonrojo { transition: opacity .25s ease; }
        @media (prefers-reduced-motion: reduce) {
          .prof-respirar, .prof-sombra, .prof-negar, .prof-saltar { animation: none !important; }
        }
      `}</style>
    </svg>
  );
}
