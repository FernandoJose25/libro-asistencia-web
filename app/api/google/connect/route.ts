import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { urlDeAutorizacion } from '@/lib/googleAuth';

export async function GET(request: Request) {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.redirect(new URL('/login', request.url));

  // El "state" lleva el id del profesor para que el callback sepa a quién
  // guardarle el refresh_token (el callback de Google no manda cookies de
  // sesión propia si el navegador es estricto con third-party context).
  const url = urlDeAutorizacion(session.user.id);
  return NextResponse.redirect(url);
}
