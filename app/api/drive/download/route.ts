import { NextResponse } from 'next/server';
import { contextoDrive } from '@/lib/driveContext';
import { descargarArchivo } from '@/lib/drive';

export async function GET(request: Request) {
  const ctx = await contextoDrive();
  if (ctx.error) return ctx.error;

  const { searchParams } = new URL(request.url);
  const archivoId = searchParams.get('archivoId');
  const mimeType = searchParams.get('mimeType') || '';
  if (!archivoId) return NextResponse.json({ error: 'Falta archivoId' }, { status: 400 });

  try {
    const { buffer, nombre, mimeSalida } = await descargarArchivo(ctx.accessToken, archivoId, mimeType);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mimeSalida,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(nombre)}"`
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'No se pudo descargar' }, { status: 502 });
  }
}
