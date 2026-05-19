import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@worldcoin") || id.includes("\\viem\\") || id.includes("/viem/") || id.includes("\\ox\\") || id.includes("/ox/")) {
            return "world-sdk";
          }

          if (id.includes("react-router-dom") || id.includes("\\react-router\\") || id.includes("/react-router/")) {
            return "router";
          }
        },
      },
    },
  },
});
