import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Fuentes cargadas con next/font en app/layout.tsx.
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif']
      },
      // Paleta "libro de clase": papel cálido, tinta azul marino y sello dorado.
      // Los colores de estado están oscurecidos para pasar contraste AA (4.5:1)
      // como texto sobre blanco, papel y sus propios fondos suaves.
      colors: {
        navy: '#101b34',
        navySoft: '#172749',
        navyActive: '#1f3260',
        gold: '#d6a72f',
        goldDark: '#8a6512',
        bg: '#f5f1e8',
        border: '#e4dccb',
        rule: '#ece5d6',
        ink: '#1c2230',
        inkSoft: '#5f6573',
        green: '#23784a',
        amber: '#9a600c',
        red: '#b23346',
        leaf: '#23784a',
        leafDark: '#1b5e3a',
        leafSoft: '#e8f2eb'
      },
      borderRadius: {
        card: '12px'
      }
    }
  },
  plugins: []
};

export default config;
