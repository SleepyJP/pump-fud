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
          // PUMP.FUD Gothic Cathedral Palette
          green: '#00FF00',          // Signature neon green
          'green-dark': '#00CC00',   // Dark green accent
          'green-light': '#33FF33',
          'green-neon': '#00FF00',
          purple: '#8A2BE2',         // Royal purple
          'purple-deep': '#4B0082',  // Deep purple/indigo
          gold: '#FFD700',           // Gold accents
          crimson: '#DC143C',        // Crimson red
          white: '#F8FAFC',
          'white-muted': '#94A3B8',
          dark: '#0A0A0A',           // True black
          'dark-darker': '#050505',
          'dark-lighter': '#1A1A1A', // Dark gray
          'dark-card': '#141414',
          'dark-border': '#2a2a2a',
          midnight: '#1A1A2E',       // Midnight blue
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
        display: ['Cinzel', 'Orbitron', 'Inter', 'serif'],  // Gothic headers
        body: ['Inter', 'system-ui', 'sans-serif'],
        gothic: ['Cinzel', 'serif'],
      },
      boxShadow: {
        'neon': '0 0 20px rgba(0, 255, 0, 0.5)',
        'neon-green': '0 0 30px rgba(0, 255, 0, 0.6)',
        'neon-purple': '0 0 30px rgba(138, 43, 226, 0.5)',
        'neon-gold': '0 0 30px rgba(255, 215, 0, 0.5)',
        'card': '0 8px 32px rgba(0, 0, 0, 0.3)',
        'glass': '0 4px 16px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
}
