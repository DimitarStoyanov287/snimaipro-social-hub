/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1A1A14', 900: '#121210', 800: '#1A1A14', 700: '#23231B', 600: '#2C2C22', 500: '#3A3A2E' },
        cream: { DEFAULT: '#EAE4DA', dim: '#B9B3A7', mute: '#8C877C' },
        brand: { yellow: '#F2C314', red: '#C63F3E', orange: '#ED773C', green: '#245E55', pink: '#EAA7C7' },
        up: '#5FBF9F',
        down: '#E5736F',
      },
      fontFamily: {
        display: ['"Bodoni Moda"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { rise: 'rise .5s cubic-bezier(.2,.7,.2,1) both' },
    },
  },
  plugins: [],
};
