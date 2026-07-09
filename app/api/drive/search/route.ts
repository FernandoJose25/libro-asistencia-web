import { NextResponse } from 'next/server';
import { contextoDrive } from '@/lib/driveContext';
import { buscarEnDrive } from '@/lib/drive';

export async function GET(request: Request) {
  const ctx = await contextoDrive();
  if (ctx.error) return ctx.error;

  const { searchParams } = new URL(request.url);
  const texto = searchParams.get('q') || '';
  if (!texto.trim()) return NextResponse.json({ items: [] });

  try {
    const items = await buscarEnDrive(ctx.accessToken, texto);
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error buscando en Drive' }, { status: 502 });
  }
}
