/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9f4',
          600: '#146c43',
          700: '#0f5132',
        },
      },
    },
  },
  plugins: [],
};
