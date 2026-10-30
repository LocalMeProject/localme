/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#10b981',
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          DEFAULT: '#ffffff',
          card: '#ffffff',
          ground: '#f8fafc',
        },
        border: {
          DEFAULT: '#e2e8f0',
          subtle: '#f1f5f9',
          strong: '#cbd5e1',
        }
      },
      fontFamily: {
        sans: ['Vazirmatn', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
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
}
