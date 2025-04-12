/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,css}", // Ensure all relevant files are included
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Define 'Inter' as the default 'font-sans'
        orbitron: ['Orbitron', 'sans-serif'], // Add 'Orbitron' if used
      },
    },
  },
  plugins: [],
};
