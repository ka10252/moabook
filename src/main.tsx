import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNativeShell, initAndroidBackButton, isNative } from "./lib/native";

// 네이티브 셸에서만 도는 준비 작업(상태바·스플래시·하드웨어 뒤로가기).
// 웹에서는 isNative가 false라 아무 일도 하지 않는다.
if (isNative) {
  void initNativeShell();
  void initAndroidBackButton();
}

// 새 배포로 프리로드된 옛 청크를 못 받으면(대개 홈스크린 PWA) 1회 새로고침으로 최신 앱을 받는다.
window.addEventListener("vite:preloadError", () => {
  if (!sessionStorage.getItem("moa_chunk_reloaded")) {
    sessionStorage.setItem("moa_chunk_reloaded", "1");
    window.location.reload();
  }
});

// 새 서비스워커가 열려 있던 페이지의 제어권을 넘겨받는 순간(=새 배포 활성화) 선제적으로 1회 새로고침.
// 이렇게 하면 옛 청크를 요청해 404가 나기 전에 최신 코드로 갈아타 "재배포마다 한 번씩 안 열림"을 막는다.
// hadController: 최초 방문(컨트롤러 없음→생성)에는 리로드하지 않고, 업데이트(기존→신규)에만 리로드.
// ⚠️ 네이티브 셸에서는 건너뛴다. 앱은 번들을 파일로 들고 있어서 '새 배포로 갈아타기'가
//    없고, 웹뷰의 서비스워커 지원이 불안정해 controllerchange가 엉뚱하게 떠 무한 새로고침이 될 수 있다.
if (!isNative && "serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let swReloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || swReloading) return;
    swReloading = true;
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);