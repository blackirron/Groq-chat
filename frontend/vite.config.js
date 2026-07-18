import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api requests to the FastAPI backend during dev so the browser
// only ever talks to one origin (avoids CORS friction).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
});
