import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#101b34',
        navySoft: '#172749',
        navyActive: '#1f3260',
        gold: '#d6a72f',
        goldDark: '#b8891f',
        bg: '#eef1f6',
        border: '#e1e6ee',
        ink: '#1f2733',
        inkSoft: '#6f7a8b',
        green: '#2f9e58',
        amber: '#d99a2b',
        red: '#d1495b',
        leaf: '#2f9e58',
        leafDark: '#227a43',
        leafSoft: '#e8f5ec'
      },
      borderRadius: {
        card: '8px'
      }
    }
  },
  plugins: []
};

export default config;
