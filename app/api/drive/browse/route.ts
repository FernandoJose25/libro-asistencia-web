import { NextResponse } from 'next/server';
import { contextoDrive } from '@/lib/driveContext';
import { listarCarpeta, ruta } from '@/lib/drive';

export async function GET(request: Request) {
  const ctx = await contextoDrive();
  if (ctx.error) return ctx.error;

  const { searchParams } = new URL(request.url);
  const carpetaId = searchParams.get('carpetaId') || undefined;

  try {
    const [items, breadcrumb] = await Promise.all([
      listarCarpeta(ctx.accessToken, carpetaId),
      ruta(ctx.accessToken, carpetaId)
    ]);
    return NextResponse.json({ items, breadcrumb });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'No se pudo leer Drive' }, { status: 502 });
  }
}
