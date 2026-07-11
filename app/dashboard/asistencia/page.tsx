import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';

export default async function AsistenciaIndexPage() {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const { data: grupos } = await supabase
    .from('grupos')
    .select('id')
    .eq('profesor_id', session.user.id)
    .eq('activo', true)
    .order('nombre')
    .limit(1);

  if (grupos && grupos.length > 0) redirect(`/dashboard/asistencia/${grupos[0].id}`);
  redirect('/dashboard/grupos');
}
