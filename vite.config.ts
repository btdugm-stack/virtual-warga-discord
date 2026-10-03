import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    // The bot server (`npm run server`) owns /api. In production it also serves the built site, so there is no proxy.
    proxy: { "/api": "http://localhost:8787" },
  },
});
