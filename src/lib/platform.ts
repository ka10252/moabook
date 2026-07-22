/**
 * 웹푸시 수신 조건은 플랫폼마다 다르다.
 *  - Android / PC / macOS Safari : 브라우저에서 알림 허용만 하면 된다
 *  - iOS / iPadOS               : iOS 16.4+ && "홈 화면에 추가"(PWA 설치) 필수.
 *                                 Safari 탭에서만 쓰면 푸시가 절대 오지 않는다.
 * 그래서 iOS 유저에게는 홈 화면 추가를 먼저 안내해야 한다.
 */

export const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ 는 데스크톱 Safari로 위장한다
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** 홈 화면에 추가되어 웹앱(standalone)으로 실행 중인가 */
export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari 전용 플래그
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

/** 이 환경에서 지금 당장 웹푸시를 받을 수 있는가 */
export const canReceivePush = () => {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  // iOS는 홈 화면에 추가된 상태에서만 푸시가 동작한다
  if (isIOS() && !isStandalone()) return false;
  return true;
};

/** iOS인데 아직 홈 화면에 추가하지 않아 푸시를 못 받는 상태 */
export const needsHomeScreenInstall = () => isIOS() && !isStandalone();
