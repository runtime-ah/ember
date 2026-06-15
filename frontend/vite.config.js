import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/ember/" : "/",
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    // Proxy API calls to the FastAPI backend during dev so the frontend can
    // use same-origin "/api/..." paths (no CORS juggling in the browser).
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
}));
