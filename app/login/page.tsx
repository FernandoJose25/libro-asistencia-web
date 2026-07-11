'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (error) {
      setError('Correo o contraseña incorrectos.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <section className="min-h-screen flex items-center justify-center bg-navy p-4">
      <form onSubmit={iniciarSesion} className="bg-white rounded-xl p-6 sm:p-10 w-full max-w-[380px] text-center shadow-2xl">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gold to-goldDark flex items-center justify-center text-2xl">
          📋
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'Georgia, serif' }}>
          Libro de Asistencia
        </h1>
        <p className="text-sm text-inkSoft mb-6 leading-relaxed">
          Ingresa con el usuario y contraseña que te dio el administrador.
        </p>

        <label className="block text-xs text-inkSoft mb-1.5 text-left">Correo</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2.5 border border-border rounded-md text-sm mb-3"
          placeholder="profesor@colegio.edu.pe"
        />

        <label className="block text-xs text-inkSoft mb-1.5 text-left">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-3 py-2.5 border border-border rounded-md text-sm mb-4"
          placeholder="••••••••"
        />

        {error && <p className="text-sm text-red mb-3">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="w-full py-3 rounded-md bg-navy text-white text-sm font-semibold hover:bg-navySoft disabled:opacity-60"
        >
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </section>
  );
}
