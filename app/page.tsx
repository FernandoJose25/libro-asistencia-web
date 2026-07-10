// RUTA: app/page.tsx
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';

export default async function Home() {
    const supabase = supabaseServer();
    const {
        data: { session }
    } = await supabase.auth.getSession();

    redirect(session ? '/dashboard' : '/login');
}
