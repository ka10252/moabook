import { lazy, type ComponentType } from 'react';

/**
 * lazy()의 안전 버전.
 *
 * 배포가 새로 되면 청크(js) 파일명 해시가 바뀐다. 그런데 홈스크린 PWA/열려있던 탭은
 * 옛 index를 실행 중이라, 탭을 눌러 lazy import 하는 순간 없어진 옛 청크를 요청 → 404 →
 * import 실패 → (ErrorBoundary 없으면) 하얀 화면. 이때 한 번만 새로고침하면 최신 앱을 받아 정상화된다.
 *
 * 무한 새로고침을 막기 위해 sessionStorage 플래그로 1회만 리로드하고, 성공 시 플래그를 지운다.
 */
const RELOAD_KEY = 'moa_chunk_reloaded';

export function lazyRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_KEY); // 정상 로드 → 다음 배포에서도 다시 리로드 가능하게
      return mod;
    } catch (err) {
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
        // 리로드가 진행되는 동안 Suspense를 pending 상태로 유지(에러를 던지지 않음)
        return new Promise<never>(() => {});
      }
      throw err; // 이미 한 번 리로드했는데도 실패 → 진짜 오류. ErrorBoundary가 받는다.
    }
  });
}
