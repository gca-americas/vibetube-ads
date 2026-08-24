import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      "/campaign": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/simulation": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/telemetry": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
});
