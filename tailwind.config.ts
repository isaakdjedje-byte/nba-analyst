import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Story 3.8: Mobile-first responsive breakpoints (AC2)
      // Default is mobile (0-639px), then enhance for larger screens
      screens: {
        'sm': '640px',   // Small tablets / large phones
        'md': '768px',   // Tablets
        'lg': '1024px',  // Desktops
        'xl': '1280px',  // Large desktops
        '2xl': '1536px', // Extra large
      },
      colors: {
        // Primary brand colors
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Status colors for decisions
        decision: {
          pick: '#10b981',      // Green for picks
          'no-bet': '#f59e0b',  // Amber for no-bet
          'hard-stop': '#ef4444', // Red for hard stops
          degraded: '#6b7280',  // Gray for degraded
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
  darkMode: 'class',
};

export default config;
