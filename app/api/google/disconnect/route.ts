import { NextResponse } from 'next/server';
import { contextoSesion } from '@/lib/driveContext';
import { desconectarDrive } from '@/lib/googleAuth';

export async function POST() {
    const ctx = await contextoSesion();
    if (ctx.error) return ctx.error;

    await desconectarDrive(ctx.session.user.id);
    return NextResponse.json({ ok: true });
}
