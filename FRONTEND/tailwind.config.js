/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', ...defaultTheme.fontFamily.sans],
        mono: ['"IBM Plex Mono"', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        primary: 'rgb(var(--vf-primary) / <alpha-value>)',
        'on-primary': 'rgb(var(--vf-on-primary) / <alpha-value>)',
      },
      // text-primary y bg-primary usan variantes con contraste AA del color
      // del tenant (utils/themeColors.ts); bordes/anillos usan la marca tal cual
      textColor: {
        primary: 'rgb(var(--vf-primary-ink) / <alpha-value>)',
      },
      backgroundColor: {
        primary: 'rgb(var(--vf-primary-fill) / <alpha-value>)',
      },
      keyframes: {
        'loading-bar': {
          '0%':   { transform: 'translateX(-100%)' },
          '50%':  { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
      },
      animation: {
        'loading-bar': 'loading-bar 1.4s ease-in-out infinite',
        'slide-up':    'slide-up 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-in-right': 'slide-in-right 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
};
