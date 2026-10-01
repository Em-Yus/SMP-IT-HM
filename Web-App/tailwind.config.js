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
        // Brand Colors (warna.json)
        primary: '#1E257F',
        primaryContainer: '#ECEEFF',
        secondary: '#84D43F',
        secondaryContainer: '#F2FBEB',
        accent: '#84D43F', // alias untuk secondary

        // Neutral Colors
        surface: '#F8F9FA',
        surfaceVariant: '#F1F3F5',
        borderNeutral: '#E2E8F0',
        divider: '#CBD5E1',

        // Typography Colors
        textPrimary: '#1A1818',
        textSecondary: '#6C757D',
        textTertiary: '#ADB5BD',

        // Semantic Colors
        semanticSuccess: '#2EC4B6',
        semanticError: '#E63946',
        semanticWarning: '#FFB703',
        semanticInfo: '#00B4D8',

        // Legacy Support
        bgSoft: '#F8F9FA',
        white: '#ffffff',
      },
    },
  },
  plugins: [],
}
