import type { Config } from 'tailwindcss';

// NOTE: colors/spacing/radii below are placeholders. Swap them for the tokens
// extracted from the Figma file during the "Figma audit" step (roadmap §7.1).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
      },
      borderRadius: {
        card: '0.75rem',
      },
    },
  },
  plugins: [],
};

export default config;
