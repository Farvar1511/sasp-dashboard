/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "sasp-yellow": "#f3c700",
        "sasp-blue": "#0a1a2e", // Example dark blue
        "sasp-gray": "#374151", // Example gray
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"], // Default app font
        orbitron: ["Orbitron", "sans-serif"], // Custom Orbitron font
      },
    },
  },
  plugins: [],
};
