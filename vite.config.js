import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Ensure the development server knows it's an SPA
  // This is often the default, but explicitly setting it can help.
  appType: "spa",
  // server: { // You might have other server options here
  //   port: 5173,
  // }
});
