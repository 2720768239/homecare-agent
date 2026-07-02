import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#FFFFFF',
        surface: '#F8F8F7',
        muted: '#F4F4F2',
        ink: {
          DEFAULT: '#111111',
          secondary: '#6B7280',
          tertiary: '#9CA3AF',
        },
        line: '#E5E7EB',
        warn: {
          bg: '#FFF7ED',
          text: '#92400E',
        },
        danger: {
          bg: '#FEF2F2',
          border: '#FECACA',
          text: '#991B1B',
        },
        ok: {
          text: '#166534',
        },
      },
      borderRadius: {
        sheet: '26px',
      },
      maxWidth: {
        app: '390px',
      },
      fontSize: {
        xxs: '11px',
      },
    },
  },
  plugins: [],
};

export default config;
