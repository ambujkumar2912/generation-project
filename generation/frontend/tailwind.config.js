/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1B2A4A',
          light: '#2A3D64',
          dark: '#121D35',
        },
        gold: {
          DEFAULT: '#D4A62A',
          light: '#E8C563',
          dark: '#A8811E',
        },
        verified: {
          DEFAULT: '#2F6F5E',
          light: '#3F8C77',
        },
        paper: '#F3F1ED',
        ink: '#1C1C1E',
      },
      fontFamily: {
        display: ['"Zilla Slab"', 'Georgia', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
