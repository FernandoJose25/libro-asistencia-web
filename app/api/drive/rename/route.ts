import { NextResponse } from 'next/server';
import { contextoDrive } from '@/lib/driveContext';
import { renombrarArchivo } from '@/lib/drive';

export async function POST(request: Request) {
  const ctx = await contextoDrive();
  if (ctx.error) return ctx.error;

  const { archivoId, nuevoNombre } = await request.json();
  if (!archivoId || !nuevoNombre) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  try {
    await renombrarArchivo(ctx.accessToken, archivoId, nuevoNombre);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'No se pudo renombrar' }, { status: 502 });
  }
}
