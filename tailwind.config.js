/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
        },
        bg: {
          base: 'var(--color-bg-base)',
          surface: 'var(--color-bg-surface)',
        },
        // Genshin dark theme palette
        'genshin-bg':        '#0D0F1A',
        'genshin-surface':   '#141626',
        'genshin-elevated':  '#1E2235',
        'genshin-border':    'rgba(255,255,255,0.08)',
        'genshin-gold':      '#C8A96E',
        'genshin-gold-light':'#E8C98A',
        'genshin-text':      '#E8E3D5',
        'genshin-muted':     '#8B8BA0',
        // Elements
        'el-anemo':   '#4EC9B0',
        'el-geo':     '#FAB632',
        'el-electro': '#A855F7',
        'el-dendro':  '#4ADE80',
        'el-hydro':   '#60A5FA',
        'el-pyro':    '#F97316',
        'el-cryo':    '#BAE6FD',
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        inter:  ['Inter', 'sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.4s ease-out',
        'pulse-glow': 'pulseGlow 2s infinite',
        'swipeIn':    'swipeIn 0.25s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(200,169,110,0.3)' },
          '50%':       { boxShadow: '0 0 24px rgba(200,169,110,0.7)' },
        },
        swipeIn: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
