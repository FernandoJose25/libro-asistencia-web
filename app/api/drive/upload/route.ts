import { NextResponse } from 'next/server';
import { contextoDrive } from '@/lib/driveContext';
import { subirArchivo } from '@/lib/drive';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ctx = await contextoDrive();
  if (ctx.error) return ctx.error;

  const form = await request.formData();
  const archivo = form.get('archivo') as File | null;
  const carpetaId = (form.get('carpetaId') as string) || undefined;

  if (!archivo) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });

  const buffer = Buffer.from(await archivo.arrayBuffer());

  try {
    const creado = await subirArchivo(
      ctx.accessToken,
      archivo.name,
      archivo.type || 'application/octet-stream',
      buffer,
      carpetaId
    );
    return NextResponse.json({ archivo: creado });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'No se pudo subir el archivo' }, { status: 502 });
  }
}
