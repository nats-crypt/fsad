/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sky: {
          darkest: '#040B1A',
          dark: '#070F22',
          DEFAULT: '#0A1628',
          mid: '#0D1F38',
          light: '#1A3A5C',
        },
        horizon: {
          DEFAULT: '#1E5F8A',
          light: '#2E86C1',
          bright: '#3DA5D9',
        },
        gold: {
          dark: '#9B7730',
          DEFAULT: '#C9A040',
          light: '#E8C87A',
          pale: '#F5E6C0',
        },
        cloud: {
          DEFAULT: '#F0F4F8',
          dark: '#E2E8F0',
          mist: '#EEF2FF',
        },
        runway: {
          DEFAULT: '#8B9BB4',
          dark: '#5A6B84',
        },
        ember: {
          DEFAULT: '#E84545',
          dark: '#C13232',
        },
        jade: {
          DEFAULT: '#27AE60',
          dark: '#1E8449',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        heading: ['"Barlow Condensed"', '"Impact"', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'hero-gradient': 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(46,134,193,0.3) 0%, transparent 60%), linear-gradient(180deg, #040B1A 0%, #0A1628 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(26,58,92,0.5) 0%, rgba(10,22,40,0.8) 100%)',
        'gold-shimmer': 'linear-gradient(90deg, #C9A040 0%, #E8C87A 50%, #C9A040 100%)',
        'runway-line': 'repeating-linear-gradient(90deg, #C9A040 0, #C9A040 20px, transparent 20px, transparent 40px)',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201,160,64,0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(201,160,64,0)' },
        },
      },
      boxShadow: {
        'card': '0 4px 24px rgba(4,11,26,0.5), 0 1px 4px rgba(0,0,0,0.3)',
        'card-hover': '0 8px 40px rgba(4,11,26,0.7), 0 2px 8px rgba(201,160,64,0.15)',
        'gold': '0 0 20px rgba(201,160,64,0.3)',
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.08)',
        'glass': '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
      },
      backdropBlur: {
        xs: '2px',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce-soft': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
