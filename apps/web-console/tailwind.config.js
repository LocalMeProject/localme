/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#3ECF8E',
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#3ECF8E',
          600: '#34b27b',
          700: '#2da16f',
          800: '#15803d',
          900: '#143826',
          950: '#0a1c13',
        },
        surface: {
          50: '#2e2e2e',
          100: '#282828',
          200: '#1f1f1f',
          300: '#1a1a1a',
          DEFAULT: '#171717',
          card: '#171717',
          ground: '#0f0f0f',
        },
        border: {
          DEFAULT: '#242424',
          subtle: '#1f1f1f',
          strong: '#2e2e2e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Source Code Pro', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
      borderRadius: {
        pill: '9999px',
      },
      spacing: {
        '4.5': '1.125rem',
      }
    },
  },
  plugins: [],
};
