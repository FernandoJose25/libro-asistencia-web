import { NextResponse } from 'next/server';
import { contextoDrive } from '@/lib/driveContext';
import { crearCarpeta } from '@/lib/drive';

export async function POST(request: Request) {
  const ctx = await contextoDrive();
  if (ctx.error) return ctx.error;

  const { nombre, carpetaId } = await request.json();
  if (!nombre) return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 });

  try {
    const carpeta = await crearCarpeta(ctx.accessToken, nombre, carpetaId);
    return NextResponse.json({ carpeta });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'No se pudo crear la carpeta' }, { status: 502 });
  }
}
