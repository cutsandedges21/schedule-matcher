/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
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
