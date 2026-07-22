import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "moa-logo.png", "moa-logo-dark.png", "icons/*.png"],
      manifest: {
        name: "MOA | 함께 읽는 책장",
        short_name: "MOA",
        description: "커뮤니티와 함께 책을 대여하고 공유하는 MOA 서비스입니다.",
        theme_color: "#F4F1EA",      // 크림 — 앱 배경과 맞춰 상태바 이질감 제거
        background_color: "#F4F1EA", // 스플래시 배경
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "ko",
        icons: [
          { src: "/icons/icon-72x72.png",   sizes: "72x72",   type: "image/png" },
          { src: "/icons/icon-96x96.png",   sizes: "96x96",   type: "image/png" },
          { src: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png" },
          { src: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png" },
          { src: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
          { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png" },
          { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      // 이게 없으면 개발 서버에는 서비스 워커가 아예 없다.
      // 푸시는 SW 위에서만 동작하므로, 켜두지 않으면 로컬에서 알림을 한 번도 테스트할 수 없다.
      devOptions: {
        enabled: true,
        type: "module",
        navigateFallback: "index.html",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
