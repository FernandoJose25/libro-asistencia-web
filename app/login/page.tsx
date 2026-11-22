'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { ProfesorMascota, type EstadoProfesor } from '@/components/ProfesorMascota';
import { Icono } from '@/components/Icono';

// Saludo según la hora y el día: siempre algo útil para el docente.
const FRANJAS = [
  { hasta: 5, saludo: 'Buenas noches', mensaje: 'Tarde para corregir, temprano para la lista. Deja todo registrado y a descansar.' },
  { hasta: 12, saludo: 'Buenos días', mensaje: 'Nueva jornada: la lista te espera antes del primer timbre.' },
  { hasta: 19, saludo: 'Buenas tardes', mensaje: 'Si la mañana fue intensa, aquí queda todo en orden.' },
  { hasta: 24, saludo: 'Buenas noches', mensaje: 'Último pendiente del día: dejar la asistencia guardada.' }
];

const DIAS_ESPECIALES: Record<number, string> = {
  0: 'Fin de semana: buen momento para ponerte al día con fechas pendientes.',
  1: 'Lunes: arranca la semana con la lista al día.',
  5: 'Viernes: cierra la semana con todas las horas registradas.',
  6: 'Fin de semana: buen momento para ponerte al día con fechas pendientes.'
};

// Renglones de cuaderno para el panel del profesor.
const RAYADO =
  'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(31,50,96,0.09) 31px, rgba(31,50,96,0.09) 32px)';

function useSaludo() {
  // Solo en el cliente: la hora del servidor (UTC) no es la del docente.
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    setAhora(new Date());
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    if (!ahora) return { saludo: 'Hola', mensaje: 'Ingresa para tomar la asistencia de tus grupos.', fecha: '', hora: '' };
    const franja = FRANJAS.find((f) => ahora.getHours() < f.hasta) || FRANJAS[FRANJAS.length - 1];
    return {
      saludo: franja.saludo,
      mensaje: DIAS_ESPECIALES[ahora.getDay()] || franja.mensaje,
      fecha: ahora.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }),
      hora: ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
    };
  }, [ahora]);
}

// Punto de pantalla donde va el texto escrito, para que el profesor lo siga
// con la mirada (en móvil no hay puntero que seguir).
let lienzo: CanvasRenderingContext2D | null = null;
function puntoDelCursor(input: HTMLInputElement) {
  const r = input.getBoundingClientRect();
  const estilo = getComputedStyle(input);
  lienzo = lienzo || document.createElement('canvas').getContext('2d');
  let ancho = 0;
  if (lienzo) {
    lienzo.font = `${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
    ancho = lienzo.measureText(input.type === 'password' ? '•'.repeat(input.value.length) : input.value).width;
  }
  return { x: Math.min(r.left + parseFloat(estilo.paddingLeft || '0') + ancho, r.right - 8), y: r.top + r.height / 2 };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState('');
  const [foco, setFoco] = useState<'email' | 'clave' | null>(null);
  const [tecleando, setTecleando] = useState(false);
  const [negando, setNegando] = useState(false);
  const [objetivo, setObjetivo] = useState<{ x: number; y: number } | null>(null);
  const pausa = useRef<ReturnType<typeof setTimeout>>();
  const { saludo, mensaje, fecha, hora } = useSaludo();

  useEffect(() => () => clearTimeout(pausa.current), []);

  const estado: EstadoProfesor = exito
    ? 'exito'
    : negando
    ? 'error'
    : cargando
    ? 'pensando'
    : foco === 'clave'
    ? verClave
      ? 'espiando'
      : 'tapado'
    : foco === 'email' && tecleando
    ? 'escribiendo'
    : 'reposo';

  function alEscribirCorreo(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    setObjetivo(puntoDelCursor(e.target));
    setTecleando(true);
    clearTimeout(pausa.current);
    pausa.current = setTimeout(() => setTecleando(false), 700);
  }

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    // El cliente se crea al enviar (no al renderizar) para que el prerender del build
    // no dependa de las variables de entorno de Supabase.
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) {
      setCargando(false);
      setError(
        /fetch|network/i.test(error.message)
          ? 'No se pudo conectar. Revisa tu internet e inténtalo de nuevo.'
          : 'Correo o contraseña incorrectos.'
      );
      setNegando(true);
      setTimeout(() => setNegando(false), 900);
      return;
    }
    setExito(true);
    // Pausa breve para que se vea la celebración antes de entrar.
    setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 650);
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-navy flex items-center justify-center px-4 py-6 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -top-48 -right-40 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(214,167,47,0.16),transparent_68%)]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-56 -left-48 w-[560px] h-[560px] rounded-full bg-[radial-gradient(circle,rgba(47,80,160,0.35),transparent_68%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

      <div className="login-entrar relative w-full max-w-[940px] grid md:grid-cols-[1.08fr_1fr] rounded-[24px] overflow-hidden bg-white shadow-[0_40px_90px_-30px_rgba(0,0,0,0.65)] ring-1 ring-white/10">
        {/* Hoja de cuaderno con el profesor y el saludo */}
        <section
          className="relative bg-bg pl-10 pr-5 py-5 sm:pl-14 sm:pr-8 md:px-12 md:py-10 flex flex-row md:flex-col items-center md:items-start gap-4 md:gap-0 border-b md:border-b-0 md:border-r border-border"
          style={{ backgroundImage: RAYADO }}
        >
          <span aria-hidden className="absolute inset-y-0 left-6 sm:left-8 w-px bg-red/40" />
          <ProfesorMascota
            estado={estado}
            objetivo={objetivo}
            className="relative shrink-0 w-[92px] sm:w-[112px] md:w-[165px] md:self-center md:mb-5"
          />
          <div className="relative min-w-0">
            <p className="inline-flex items-center gap-2 text-[11px] md:text-[12px] font-bold uppercase tracking-[0.14em] text-goldDark min-h-[16px]">
              {fecha && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_#d6a72f]" />
                  {fecha} · {hora}
                </>
              )}
            </p>
            <h1 className="font-display text-[30px] sm:text-[38px] md:text-[48px] leading-[0.98] font-semibold text-ink mt-1.5 md:mt-2">
              {saludo},<br />
              profe<span className="text-gold">.</span>
            </h1>
            <p className="mt-2 md:mt-3 text-[13.5px] md:text-[15px] text-inkSoft leading-relaxed max-w-[340px]">{mensaje}</p>
          </div>
        </section>

        {/* Formulario */}
        <section className="px-6 py-7 sm:px-10 md:py-10 flex items-center">
          <form onSubmit={iniciarSesion} className="w-full max-w-[360px] mx-auto">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-[12px] shrink-0 bg-gradient-to-br from-gold to-goldDark flex items-center justify-center text-navy shadow-[0_8px_20px_-6px_rgba(214,167,47,0.6)]">
                <Icono nombre="libro" className="w-[22px] h-[22px]" />
              </div>
              <div>
                <p className="font-display text-[20px] font-semibold leading-none text-ink">Libro de Asistencia</p>
                <p className="text-[11px] uppercase tracking-[0.16em] text-inkSoft mt-1">Panel docente</p>
              </div>
            </div>

            <p className="text-[11.5px] uppercase tracking-[0.18em] font-bold text-goldDark">Iniciar sesión</p>
            <h2 className="font-display text-[28px] font-semibold leading-tight text-ink mt-1 mb-6">Abre tu libro de asistencia</h2>

            <label htmlFor="correo" className="block text-[13px] font-bold text-ink mb-1.5">
              Correo
            </label>
            <div className="flex items-center gap-2.5 rounded-[12px] border border-border bg-bg/40 px-3.5 h-[52px] mb-4 transition focus-within:border-navy focus-within:bg-white focus-within:ring-4 focus-within:ring-gold/25">
              <Icono nombre="correo" className="w-[18px] h-[18px] text-inkSoft" />
              <input
                id="correo"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={alEscribirCorreo}
                onFocus={(e) => {
                  setFoco('email');
                  setObjetivo(puntoDelCursor(e.target));
                }}
                onBlur={() => {
                  setFoco(null);
                  setObjetivo(null);
                }}
                required
                className="flex-1 min-w-0 bg-transparent outline-none text-[16px] placeholder:text-inkSoft/60"
                placeholder="profesor@colegio.edu.pe"
              />
            </div>

            <label htmlFor="clave" className="block text-[13px] font-bold text-ink mb-1.5">
              Contraseña
            </label>
            <div className="flex items-center gap-2.5 rounded-[12px] border border-border bg-bg/40 pl-3.5 pr-1.5 h-[52px] mb-5 transition focus-within:border-navy focus-within:bg-white focus-within:ring-4 focus-within:ring-gold/25">
              <Icono nombre="candado" className="w-[18px] h-[18px] text-inkSoft" />
              <input
                id="clave"
                type={verClave ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setObjetivo(puntoDelCursor(e.target));
                }}
                onFocus={(e) => {
                  setFoco('clave');
                  setObjetivo(puntoDelCursor(e.target));
                }}
                onBlur={() => {
                  setFoco(null);
                  setObjetivo(null);
                }}
                required
                className="flex-1 min-w-0 bg-transparent outline-none text-[16px] placeholder:text-inkSoft/60"
                placeholder="••••••••"
              />
              <button
                type="button"
                // Sin robar el foco al campo: así el profesor "espía" en vez de soltar el libro.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setVerClave((v) => !v)}
                aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={verClave}
                className="w-10 h-10 flex items-center justify-center rounded-[9px] text-inkSoft hover:text-ink hover:bg-bg"
              >
                <Icono nombre={verClave ? 'ojoNo' : 'ojo'} className="w-[18px] h-[18px]" />
              </button>
            </div>

            {error && (
              <div role="alert" className="mb-5 flex items-start gap-2 rounded-[10px] bg-red/10 border border-red/30 px-3 py-2.5 text-[13.5px] text-red">
                <Icono nombre="alerta" className="w-4 h-4 mt-0.5" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando || exito}
              className={`w-full h-[52px] rounded-[12px] inline-flex items-center justify-center gap-2 text-[15.5px] font-bold text-white transition active:scale-[0.99] disabled:cursor-default ${
                exito ? 'bg-green' : 'bg-navy hover:bg-navyActive disabled:opacity-80'
              }`}
            >
              {exito ? (
                <>
                  <Icono nombre="check" className="w-[18px] h-[18px]" /> ¡Bienvenido!
                </>
              ) : cargando ? (
                <>
                  <Icono nombre="cargando" className="w-[18px] h-[18px] animate-spin" /> Ingresando…
                </>
              ) : (
                <>
                  Ingresar <Icono nombre="flecha" className="w-[18px] h-[18px] text-gold" />
                </>
              )}
            </button>

            <p className="mt-5 text-center text-[12.5px] text-inkSoft leading-relaxed">
              Ingresa con el usuario y contraseña que te dio el administrador.
            </p>
          </form>
        </section>
      </div>

      <style>{`
        .login-entrar { animation: login-entrar .7s cubic-bezier(.16,1,.3,1) both; }
        @keyframes login-entrar { from { opacity: 0; transform: translateY(14px) scale(.99); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .login-entrar { animation: none; } }
      `}</style>
    </main>
  );
}
