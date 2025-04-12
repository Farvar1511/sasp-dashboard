const tailwindcss = require("@tailwindcss/postcss")();

module.exports = {
  plugins: [
    tailwindcss, // ✅ Correct usage for Tailwind v4
    require("autoprefixer"), // Add autoprefixer for compatibility
  ],
};
