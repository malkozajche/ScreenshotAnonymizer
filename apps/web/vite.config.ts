import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Screenshot Anonymizer",
        short_name: "AnonShots",
        description:
          "Scan and anonymize screenshots for documentation — on your device.",
        theme_color: "#0c1f1a",
        background_color: "#0c1f1a",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@sa/pipeline": path.resolve(
        __dirname,
        "../../packages/pipeline/src/index.ts",
      ),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
});
