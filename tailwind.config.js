/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"], // Default app font
        orbitron: ["Orbitron", "sans-serif"], // Custom Orbitron font
      },
    },
  },
  plugins: [],
};
