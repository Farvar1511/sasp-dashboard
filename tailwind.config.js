/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,css}", // Include all relevant files
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Ensure 'Inter' is defined as 'font-sans'
        orbitron: ['Orbitron', 'sans-serif'], // Add 'Orbitron' if used
      },
    },
  },
  plugins: [],
};
