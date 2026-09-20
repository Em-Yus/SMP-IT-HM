/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      colors: {
        primary: '#2a2c87',
        accent: '#85c226',
        bgSoft: '#daffcc',
        white: '#ffffff',
      },
    },
  },
  plugins: [],
}
