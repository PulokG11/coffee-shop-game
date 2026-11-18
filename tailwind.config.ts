import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        board: { DEFAULT: '#22302a', raised: '#2c3c35', line: '#3d5047' },
        chalk: { DEFAULT: '#eceee4', dim: '#b4bfb6' },
        paper: { DEFAULT: '#ffffff', edge: '#e6e2d8', tint: '#f6f4ee' },
        ink: { DEFAULT: '#2a1d17', soft: '#5b514b', faint: '#8a817b' },
        cherry: { DEFAULT: '#c8283b', dark: '#8e1626', tint: '#fbe3e6' },
        marigold: { DEFAULT: '#f2b134', dark: '#b07a10', tint: '#fdf0d2' },
        pistachio: { DEFAULT: '#a8cf9b', dark: '#6f9c62' },
        till: { DEFAULT: '#0e1210', glow: '#9cf2c8' },
        good: { DEFAULT: '#0ca30c', ink: '#006300', tint: '#e2f4e2' },
        bad: { DEFAULT: '#d03b3b', ink: '#b42318', tint: '#fde8e8' },
      },
      fontFamily: {
        display: ['"Lilita One"', 'system-ui', 'sans-serif'],
        body: ['Lexend', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
