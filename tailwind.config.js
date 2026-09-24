/** @type {import('tailwindcss').Config} */
const tokens = require('./src/theme/tokens.generated.json');

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: Object.fromEntries(
        Object.entries(tokens)
          .filter(([name]) => name.startsWith('color-'))
          .map(([name, value]) => [name.slice(6), value]),
      ),
      maxWidth: { page: tokens['page-max'] },
      borderRadius: { card: tokens['radius-lg'], pill: tokens['radius-pill'] },
      minHeight: { target: tokens['target-min'] },
      minWidth: { target: tokens['target-min'] },
    },
  },
  plugins: [],
};
