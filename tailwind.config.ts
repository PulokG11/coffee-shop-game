import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        coffee: {
          50: '#fdf8f0',
          100: '#f8edd8',
          200: '#f0d5a0',
          300: '#e8b86d',
          400: '#d4883c',
          500: '#b8651e',
          600: '#964f17',
          700: '#723c14',
          800: '#4f2a0f',
          900: '#2e1808',
        },
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
        body: ['system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
