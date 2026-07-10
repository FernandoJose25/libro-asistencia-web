import { NextResponse } from 'next/server';
import { supabaseServer } from './supabaseServer';
import { obtenerAccessToken } from './googleAuth';

// Para endpoints que sí necesitan hablar con Drive.
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

// Para endpoints que solo necesitan saber quién es el profesor (no hablan
// con Drive) — no debe exigir Drive conectado para, por ejemplo, cambiar el
// umbral de riesgo de un grupo.
export async function contextoSesion() {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'NO_AUTENTICADO' }, { status: 401 }) };
  }
  return { session, supabase };
}
