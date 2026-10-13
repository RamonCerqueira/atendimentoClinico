import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)', muted: 'var(--muted)', subtle: 'var(--subtle)',
        line: 'var(--line)', paper: 'var(--paper)', surface: 'var(--white)',
        brand: 'var(--brand)', 'brand-dark': 'var(--brand-dark)', 'brand-pale': 'var(--brand-pale)',
        clinical: 'var(--teal)', 'clinical-pale': 'var(--teal-pale)',
      },
      fontFamily: { sans: ['var(--font-sans)'] },
      borderRadius: { panel: 'var(--radius)' },
      boxShadow: { panel: 'var(--shadow)', elevated: 'var(--shadow-lg)' },
      screens: { xs: '480px' },
      transitionDuration: { 180: '180ms' },
    },
  },
  plugins: [],
}

export default config
