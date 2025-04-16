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
        neutral: {
          50: "#f9f9f9",
          100: "#e5e5e5",
          200: "#d4d4d4",
          300: "#a3a3a3",
          400: "#737373",
          500: "#525252",
          600: "#3f3f3f",
          700: "#2f2f2f",
          800: "#1f1f1f",
          900: "#141414",
          950: "#0a0a0a", // deeper black
        },
        brand: {
          DEFAULT: "#f3c700",
          dark: "#eab308",
          50: "#fffdea",
          100: "#fff3b0",
          500: "#f3c700",
          600: "#eab308",
        },
        background: {
          light: "#ffffff",
          DEFAULT: "#0e0e0e", // main background
          dark: "#000000",
        },
        foreground: {
          DEFAULT: "#f1f1f1",
          muted: "#999999",
          dim: "#666666",
        },
      },
      boxShadow: {
        card: "0 4px 8px rgba(0, 0, 0, 0.2)",
        glow: "0 0 10px rgba(243, 199, 0, 0.5)",
      },
      borderRadius: {
        xl: "1rem",
      },
    },
  },
  plugins: [
            require('@tailwindcss/typography'),
            require('@tailwindcss/forms'),
            require('@tailwindcss/aspect-ratio'),
            require('@tailwindcss/line-clamp'),
  ],
};
