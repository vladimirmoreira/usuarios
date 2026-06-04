/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fff4e0',  // ámbar cálido — sin tono salmon/pastel
          100: '#ffd9a0',  // naranja claro saturado
          200: '#ffb347',  // ámbar medio
          500: '#f97316',  // naranja puro
          600: '#ea580c',  // naranja profundo
          700: '#c2410c',  // naranja oscuro
          800: '#9a3412',  // naranja quemado
          900: '#431407',  // oscuro para sombras dark mode
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
