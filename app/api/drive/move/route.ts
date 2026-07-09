import { NextResponse } from 'next/server';
import { contextoDrive } from '@/lib/driveContext';
import { moverArchivo } from '@/lib/drive';

export async function POST(request: Request) {
  const ctx = await contextoDrive();
  if (ctx.error) return ctx.error;

  const { archivoId, nuevaCarpetaId } = await request.json();
  if (!archivoId || !nuevaCarpetaId) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  try {
    await moverArchivo(ctx.accessToken, archivoId, nuevaCarpetaId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'No se pudo mover' }, { status: 502 });
  }
}
