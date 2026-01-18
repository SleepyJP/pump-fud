/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pump: {
          green: '#4ADE80',
          'green-light': '#86EFAC',
          'green-dark': '#22C55E',
          'green-neon': '#00FF66',
          white: '#F8FAFC',
          'white-muted': '#94A3B8',
          dark: '#0d0d0d',
          'dark-darker': '#080808',
          'dark-lighter': '#1a1a1a',
          'dark-card': '#141414',
          'dark-border': '#2a2a2a',
        },
        tier: {
          1: '#3B82F6',
          2: '#8B5CF6',
          3: '#EAB308',
          4: '#F97316',
          5: '#EF4444',
        }
      },
      fontFamily: {
        display: ['Orbitron', 'Inter', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon': '0 0 20px rgba(74, 222, 128, 0.5)',
        'card': '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
}
