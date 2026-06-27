/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta corporativa: azul moderno (escala Tailwind blue) con buen contraste.
        brand: {
          50:  '#eff6ff',  // fondo muy claro
          100: '#dbeafe',  // fondo claro / chips
          200: '#bfdbfe',  // bordes suaves / hover claro
          500: '#3b82f6',  // azul medio (acentos)
          600: '#2563eb',  // azul primario (botones, activo)
          700: '#1d4ed8',  // azul profundo (hover de botones)
          800: '#1e40af',  // azul oscuro
          900: '#172554',  // muy oscuro (dark mode / sombras)
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
