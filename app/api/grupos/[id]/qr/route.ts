import { NextResponse } from 'next/server';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { contextoSesion } from '@/lib/driveContext';

// Genera un token de sesión de clase (vence en 20 minutos) y el QR que apunta
// a la página pública donde los alumnos se marcan presentes ellos mismos.
export async function POST(request: Request, { params }: { params: { id: string } }) {
    const ctx = await contextoSesion();
    if (ctx.error) return ctx.error;
    const { session, supabase } = ctx;

    const { horasClaseDia } = await request.json();
    const horas = horasClaseDia === 2 ? 2 : 1;

    const { data: grupo } = await supabase
        .from('grupos')
        .select('id')
        .eq('id', params.id)
        .eq('profesor_id', session.user.id)
        .single();

    if (!grupo) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });

    const token = crypto.randomBytes(16).toString('hex');
    const hoy = new Date().toISOString().slice(0, 10);
    const expiraEn = new Date(Date.now() + 20 * 60 * 1000).toISOString();

    const { error } = await supabase.from('sesiones_qr').insert({
        token,
        grupo_id: grupo.id,
        fecha: hoy,
        horas_clase_dia: horas,
        expira_en: expiraEn
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const url = `${process.env.NEXT_PUBLIC_SITE_URL}/asistencia-qr/${token}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1 });

    return NextResponse.json({ url, qrDataUrl, expiraEn });
}
