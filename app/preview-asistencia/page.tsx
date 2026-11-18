// TEMPORAL — solo para capturas de diseño; se borra antes de commitear.
import { Sidebar } from '@/components/Sidebar';
import { SidebarProvider } from '@/components/SidebarContext';
import { Topbar } from '@/components/Topbar';
import { AsistenciaTabs } from '@/components/AsistenciaTabs';
import { AsistenciaClient } from '@/components/AsistenciaClient';
import { fechaLocalISO } from '@/lib/utils';

const NOMBRES = [
  'Cabrera Martínez, Kevin Rodrigo', 'Chávez López, Braulio André', 'De Luna Cervantes, Jessy', 'Gómez Ramírez, Santiago',
  'Gutrón Juárez, Jesús Antonio', 'Jara Legaspe, Emanuel de Jesús', 'Ledezma Ortega, Ángela Fernanda', 'López Flores, Kimberly Naomi',
  'López García, Ángel Santiago', 'López Martínez, Pedro Daniel', 'Medina Aguayo, Marcos Isaac', 'Montaño Torres, Yaretzi Mariana',
  'Muñoz Torres, Jorge Owen', 'Muñoz Macías, Clara Luz', 'Padilla Ávila, Máximo Antonio', 'Pedroza Castro, Mario Santiago',
  'Terrones Martínez, Yandel Guadalupe', 'Ulloa Reyes, Valeria', 'Vargas Soto, Ximena', 'Zamora Díaz, Iker'
];

export default function Preview() {
  const alumnos = NOMBRES.map((n, i) => {
    const [apellidos, nombres] = n.split(', ');
    return { id: `a${i}`, grupo_id: 'g1', nombre: `${apellidos} ${nombres}`, apellidos, nombres, orden: i };
  });
  const riesgo: Record<string, { porcentajeFalta: number; totalFaltas: number; enRiesgo: boolean }> = {};
  alumnos.forEach((a, i) => {
    const faltas = [3, 5, 2, 4, 6, 4, 1, 4, 7, 5, 0, 2, 3, 1, 10, 4, 5, 0, 2, 1][i];
    riesgo[a.id] = { porcentajeFalta: (faltas / 12) * 100, totalFaltas: faltas, enRiesgo: faltas >= 3 };
  });
  const hoy = fechaLocalISO();
  const registros: Record<string, any> = {};
  alumnos.slice(0, 6).forEach((a, i) => {
    registros[a.id] = { estatus: i === 2 ? 'tardanza' : i === 4 ? 'falto' : 'asistio', marcado_en: new Date().toISOString(), justificada: i === 4, justificacion_motivo: 'salud', justificacion_detalle: 'Cita médica' };
  });
  const sesiones = ['2026-11-03|1', '2026-11-05|1', '2026-11-10|1', '2026-11-12|1', '2026-11-12|2', '2026-11-17|1'];
  const grupos = [
    { id: 'g1', profesor_id: 'p', archivo_id_nube: '', nombre: 'Física 5°A', activo: true, ultima_sync: null },
    { id: 'g2', profesor_id: 'p', archivo_id_nube: '', nombre: 'Química 1°D', activo: true, ultima_sync: null },
    { id: 'g3', profesor_id: 'p', archivo_id_nube: '', nombre: 'Química 1°F', activo: true, ultima_sync: null }
  ];
  return (
    <SidebarProvider>
      <div className="flex h-dvh">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar breadcrumb="Asistencia / Física 5°A" inicial="P" />
          <AsistenciaTabs grupos={grupos} />
          <AsistenciaClient
            grupoId="g1"
            grupoNombre="Física 5°A"
            alumnosIniciales={alumnos}
            fechaInicial={hoy}
            registrosIniciales={registros}
            sesionesGuardadas={sesiones}
            umbralInicial={20}
            horasClaseSemanaInicial={4}
            faltasPermitidasSemestreInicial={12}
            riesgoPorAlumno={riesgo}
            diasHeatmap={sesiones.map((s, i) => ({ fecha: s.split('|')[0], tasaAsistencia: [0.95, 0.8, 0.6, 0.92, 0.4, 0.85][i] }))}
          />
        </div>
      </div>
    </SidebarProvider>
  );
}
