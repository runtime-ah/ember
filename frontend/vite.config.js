import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Proxy API calls to the FastAPI backend during dev so the frontend can
    // use same-origin "/api/..." paths (no CORS juggling in the browser).
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
