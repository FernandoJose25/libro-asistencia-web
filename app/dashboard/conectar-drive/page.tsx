import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { tieneDriveConectado } from '@/lib/googleAuth';

export default async function ConectarDrivePage({
  searchParams
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const conectado = await tieneDriveConectado(session.user.id);
  if (conectado) redirect('/dashboard');

  const error = searchParams.drive_error;

  return (
    <section className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="bg-white rounded-xl p-6 sm:p-10 w-full max-w-[420px] text-center shadow-2xl border border-border">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gold to-goldDark flex items-center justify-center text-2xl">
          🔗
        </div>
        <h1 className="text-xl font-bold mb-2">Conecta tu Google Drive</h1>
        <p className="text-sm text-inkSoft mb-6 leading-relaxed">
          Esto es un paso único. Vas a ver la pantalla normal de Google pidiendo permiso para leer y
          escribir tus archivos — acéptalo con la cuenta donde guardas tus documentos de asistencia.
          Nunca vas a tener que volver a hacer esto.
        </p>

        {error && (
          <p className="text-sm text-red mb-4">
            No se pudo conectar ({error}). Intenta de nuevo o avisa al administrador.
          </p>
        )}

        <a
          href="/api/google/connect"
          className="block w-full py-3 rounded-md bg-navy text-white text-sm font-semibold hover:bg-navySoft"
        >
          Conectar Google Drive
        </a>

        <form action="/auth/signout" method="post" className="mt-4">
          <button className="text-xs text-inkSoft hover:text-ink">Salir</button>
        </form>
      </div>
    </section>
  );
}
