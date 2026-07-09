'use client';

import { supabaseBrowser } from '@/lib/supabaseClient';

export default function LoginPage() {
  const supabase = supabaseBrowser();

  async function iniciarSesion() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        // Scope adicional para poder leer/escribir en la carpeta de Drive del profesor.
        // "drive.file" solo da acceso a archivos creados o abiertos por esta app,
        // no a todo el Drive del profesor — es el scope recomendado para esto.
        scopes: 'https://www.googleapis.com/auth/drive.file',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });
  }

  return (
    <section className="min-h-screen flex items-center justify-center bg-navy">
      <div className="bg-white rounded-xl p-10 w-[380px] text-center shadow-2xl">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gold to-goldDark flex items-center justify-center text-2xl">
          📋
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'Georgia, serif' }}>
          Libro de Asistencia
        </h1>
        <p className="text-sm text-inkSoft mb-6 leading-relaxed">
          Inicia sesión con tu cuenta de Google para conectar la carpeta de Drive donde guardas tus grupos.
        </p>
        <button
          onClick={iniciarSesion}
          className="w-full py-3 rounded-md bg-navy text-white text-sm font-semibold hover:bg-navySoft"
        >
          Iniciar sesión con Google
        </button>
      </div>
    </section>
  );
}
