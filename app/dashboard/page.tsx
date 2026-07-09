import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { tieneDriveConectado } from '@/lib/googleAuth';
import { Topbar } from '@/components/Topbar';

export default async function DashboardPage() {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const conectado = await tieneDriveConectado(session.user.id);
  if (!conectado) redirect('/dashboard/conectar-drive');

  const { data: grupos } = await supabase
    .from('grupos')
    .select('id, nombre, activo')
    .eq('profesor_id', session.user.id)
    .eq('activo', true)
    .order('nombre');

  const { data: horasFalta } = await supabase
    .from('horas_falta_por_alumno')
    .select('grupo_id, horas_falta_total');

  const totalHorasFalta = (horasFalta || []).reduce((acc, r: any) => acc + (r.horas_falta_total || 0), 0);
  const inicial = (session.user.email || 'P')[0].toUpperCase();

  return (
    <>
      <Topbar breadcrumb="Dashboard" inicial={inicial} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1020px] mx-auto px-8 py-7 pb-14">
          <h2 className="text-xl font-bold mb-5">Resumen</h2>

          <div className="grid grid-cols-3 gap-3.5 mb-8">
            <div className="bg-white border border-border rounded-card p-4">
              <div className="text-[11px] uppercase tracking-wide text-inkSoft mb-2">Grupos</div>
              <div className="text-2xl font-bold">{grupos?.length ?? 0}</div>
              <div className="text-[11.5px] text-inkSoft mt-1">conectados desde Drive</div>
            </div>
            <div className="bg-white border border-border rounded-card p-4">
              <div className="text-[11px] uppercase tracking-wide text-inkSoft mb-2">Google Drive</div>
              <div className="text-base font-bold truncate text-green">Conectado</div>
              <div className="text-[11.5px] text-inkSoft mt-1">
                <Link href="/dashboard/drive" className="text-goldDark font-semibold">Explorar archivos</Link>
              </div>
            </div>
            <div className="bg-white border border-border rounded-card p-4">
              <div className="text-[11px] uppercase tracking-wide text-inkSoft mb-2">Horas de falta acumuladas</div>
              <div className="text-2xl font-bold text-red">{totalHorasFalta}</div>
              <div className="text-[11.5px] text-inkSoft mt-1">en todos los grupos</div>
            </div>
          </div>

          <h3 className="text-[15px] font-bold mb-3">Grupos</h3>
          <div className="bg-white border border-border rounded-card overflow-hidden">
            {(grupos || []).length === 0 && (
              <div className="p-4 text-sm text-inkSoft">
                Aún no hay grupos. Ve a{' '}
                <Link href="/dashboard/drive" className="text-goldDark font-semibold">Drive</Link>{' '}
                y marca un archivo como "Usar para asistencia".
              </div>
            )}
            {(grupos || []).map((g, i) => (
              <Link
                key={g.id}
                href={`/dashboard/grupo/${g.id}`}
                className={`flex items-center justify-between px-4 py-3 text-sm hover:bg-black/[0.02] ${
                  i > 0 ? 'border-t border-border' : ''
                }`}
              >
                <span className="font-semibold">{g.nombre}</span>
                <span className="text-inkSoft">Tomar asistencia →</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
