import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible, Crimson_Pro } from 'next/font/google';
import './globals.css';

// Atkinson Hyperlegible: diseñada para máxima legibilidad (nombres de alumnos
// en un celular, de pie frente al salón). Crimson Pro: serif de libro para
// títulos, en línea con la identidad "Libro de Asistencia".
const sans = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-sans',
  display: 'swap'
});

const display = Crimson_Pro({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Libro de Asistencia',
  description: 'Toma de asistencia por grupo, sincronizada con Google Drive.'
};

export const viewport: Viewport = {
  themeColor: '#101b34'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
