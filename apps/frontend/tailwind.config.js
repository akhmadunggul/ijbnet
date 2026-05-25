/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#f0f4ff',
          100: '#dde5ff',
          200: '#bfccf5',
          300: '#93aaeb',
          400: '#6080d1',
          500: '#3357a8',
          600: '#243f88',
          700: '#1a3672',
          800: '#122758',
          900: '#0e1f4a',
        },
        gold: {
          50:  '#fffae8',
          200: '#f8d980',
          400: '#f0b429',
          500: '#d99d0a',
          600: '#b07e08',
          700: '#896006',
        },
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
