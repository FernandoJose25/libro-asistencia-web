import { NextResponse } from 'next/server';
import { guardarTokenDesdeCodigo } from '@/lib/googleAuth';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const profesorId = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard/conectar-drive?drive_error=${encodeURIComponent(error)}`);
  }
  if (!code || !profesorId) {
    return NextResponse.redirect(`${origin}/dashboard/conectar-drive?drive_error=faltan_datos`);
  }

  try {
    await guardarTokenDesdeCodigo(profesorId, code);
  } catch (e: any) {
    return NextResponse.redirect(`${origin}/dashboard/conectar-drive?drive_error=${encodeURIComponent(e.message || 'desconocido')}`);
  }

  return NextResponse.redirect(`${origin}/dashboard/drive`);
}