const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx,html,css}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
        orbitron: ["Orbitron", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#f3c700",
          dark: "#eab308",
          50: "#fffdea",
          100: "#fff3b0",
          500: "#f3c700",
          600: "#eab308",
        },
      },
      boxShadow: {
        card: "0 4px 8px rgba(0, 0, 0, 0.1)",
        glow: "0 0 10px rgba(243, 199, 0, 0.5)",
      },
      borderRadius: {
        xl: "1rem",
      },
    },
  },
  plugins: [],
};
