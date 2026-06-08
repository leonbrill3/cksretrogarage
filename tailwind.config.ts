import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0c0c0d',
          900: '#0c0c0d',
          800: '#141416',
          700: '#1c1c1f',
          600: '#26262a',
        },
        bone: {
          DEFAULT: '#f4f1ea',
          muted: '#cfcabd',
          dim: '#8d877a',
        },
        oxblood: {
          DEFAULT: '#7c1c22',
          light: '#9a2a31',
          deep: '#5e1318',
        },
        brass: {
          DEFAULT: '#b89b5e',
          light: '#cdb478',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        label: '0.22em',
      },
      maxWidth: {
        site: '1320px',
      },
    },
  },
  plugins: [],
};

export default config;
