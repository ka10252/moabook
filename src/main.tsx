import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 새 배포로 프리로드된 옛 청크를 못 받으면(대개 홈스크린 PWA) 1회 새로고침으로 최신 앱을 받는다.
window.addEventListener("vite:preloadError", () => {
  if (!sessionStorage.getItem("moa_chunk_reloaded")) {
    sessionStorage.setItem("moa_chunk_reloaded", "1");
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);