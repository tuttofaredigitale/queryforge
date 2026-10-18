/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        }
      }
    },
  },
  variants: {
    extend: {
      backgroundColor: ['dark', 'dark-hover', 'hover'],
      borderColor: ['dark', 'dark-focus'],
      textColor: ['dark', 'dark-hover'],
    },
  },
  plugins: [],
}