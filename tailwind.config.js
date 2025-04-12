// tailwind.config.js
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // 👈 this enables font-sans
        orbitron: ['Orbitron', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
