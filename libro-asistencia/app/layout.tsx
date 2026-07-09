import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Libro de Asistencia',
  description: 'Toma de asistencia por grupo, sincronizada con Google Drive.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
