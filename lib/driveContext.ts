import { NextResponse } from 'next/server';
import { supabaseServer } from './supabaseServer';
import { obtenerAccessToken } from './googleAuth';

export async function contextoDrive() {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'NO_AUTENTICADO' }, { status: 401 }) };
  }

  try {
    const accessToken = await obtenerAccessToken(session.user.id);
    return { session, accessToken, supabase };
  } catch (e: any) {
    if (e.message === 'SIN_DRIVE_CONECTADO') {
      return { error: NextResponse.json({ error: 'SIN_DRIVE_CONECTADO' }, { status: 409 }) };
    }
    return { error: NextResponse.json({ error: e.message || 'Error de Google' }, { status: 502 }) };
  }
}
