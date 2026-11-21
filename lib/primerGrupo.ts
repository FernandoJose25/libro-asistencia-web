import { redirect } from 'next/navigation';
import { supabaseServer } from './supabaseServer';

// Para /dashboard/asistencia, /trabajos y /examenes sin grupo elegido: abre el
// primer grupo activo, o Grupos si todavía no hay ninguno.
export async function redirigirAlPrimerGrupo(base: string): Promise<never> {
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

  if (grupos && grupos.length > 0) redirect(`${base}/${grupos[0].id}`);
  redirect('/dashboard/grupos');
}
