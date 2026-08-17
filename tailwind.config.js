/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /**
       * The school accent, resolved at runtime from CSS custom properties that
       * SchoolThemeEffect writes onto :root. Bare `var()` rather than the
       * `rgb(... / <alpha-value>)` form, so opacity modifiers (`bg-accent/50`)
       * do not work — nothing needs one, and the plain form keeps the school
       * table in src/domain/schools.ts as ordinary hex.
       */
      colors: {
        accent: {
          DEFAULT: 'var(--accent)',
          strong: 'var(--accent-strong)',
          soft: 'var(--accent-soft)',
          fg: 'var(--accent-fg)',
        },
      },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom)',
      },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
      keyframes: {
        // The indeterminate progress bar: a short segment crossing the track.
        'progress-slide': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
      },
      animation: {
        'progress-slide': 'progress-slide 1.3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
