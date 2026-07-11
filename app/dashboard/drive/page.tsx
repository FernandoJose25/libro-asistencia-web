import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { tieneDriveConectado } from '@/lib/googleAuth';
import { Topbar } from '@/components/Topbar';
import { DriveExplorer } from '@/components/DriveExplorer';
import { MigrarAsistenciaButton } from '@/components/MigrarAsistenciaButton';

export default async function DrivePage() {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const conectado = await tieneDriveConectado(session.user.id);
  if (!conectado) redirect('/dashboard/conectar-drive');

  const inicial = (session.user.email || 'P')[0].toUpperCase();

  return (
    <>
      <Topbar breadcrumb="Archivos / Mi Drive" inicial={inicial} />
      <div className="px-6 pt-4">
        <MigrarAsistenciaButton />
      </div>
      <DriveExplorer />
    </>
  );
}
