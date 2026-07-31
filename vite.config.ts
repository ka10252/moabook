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
        // 대형 폰트는 프리캐시(설치 시 전량 다운로드)에서 제외 → PWA 설치 payload 축소.
        //  - Galmuri11(496KB): 가상공간 픽셀 라벨 전용, 대부분 유저는 안 씀
        //  - Noto Sans KR(559KB): 책등 세로 라벨용, 필요 시 네트워크에서 로드(브라우저 캐시 적용)
        globIgnores: ["**/Galmuri11*.woff2", "**/noto-sans-kr-*.woff*"],
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
  build: {
    rollupOptions: {
      output: {
        // 공유 vendor를 안정적인 캐시 단위로 분리 → 앱 코드가 바뀌어도 vendor 캐시 유지,
        // 병렬 다운로드로 첫 파싱 부담 완화. (Phaser는 건드리지 않아 VirtualSpacePage lazy 청크 유지)
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("phaser")) return; // 동적 import 청크(가상공간)에 그대로 둔다
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("@tanstack")) return "query";
          if (/[\\/]react(-dom|-router-dom)?[\\/]/.test(id)) return "react";
          // 그 외(date-fns·lucide 등)는 Rollup 기본 청킹에 맡긴다(lazy 전용 lib를 eager로 끌어올리지 않도록)
        },
      },
    },
  },
});
