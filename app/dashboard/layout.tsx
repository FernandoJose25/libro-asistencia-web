import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { Sidebar } from '@/components/Sidebar';
import { SidebarProvider } from '@/components/SidebarContext';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  return (
    <SidebarProvider>
      {/* h-dvh: alto real visible en móvil (100vh incluye la barra del
          navegador y deja contenido/acciones tapados abajo). */}
      <div className="flex h-dvh">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 fondo-quimica">{children}</div>
      </div>
    </SidebarProvider>
  );
}
