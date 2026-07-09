import { NextResponse } from 'next/server';
import { contextoDrive } from '@/lib/driveContext';
import { copiarArchivo } from '@/lib/drive';

export async function POST(request: Request) {
  const ctx = await contextoDrive();
  if (ctx.error) return ctx.error;

  const { archivoId, nuevoNombre, carpetaId } = await request.json();
  if (!archivoId || !nuevoNombre) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  try {
    const copia = await copiarArchivo(ctx.accessToken, archivoId, nuevoNombre, carpetaId);
    return NextResponse.json({ archivo: copia });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'No se pudo copiar' }, { status: 502 });
  }
}
