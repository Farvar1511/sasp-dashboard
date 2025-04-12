// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export const content = ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"];
export const theme = {
  extend: {
    fontFamily: {
      sans: ["Inter", "sans-serif"], // ⬅️ enables `font-sans`
      orbitron: ["Orbitron", "sans-serif"], // ⬅️ enables `font-orbitron`
    },
  },
};
export const plugins = [];
