import { Capacitor } from '@capacitor/core';

/**
 * 네이티브 셸(iOS·Android)에서 도는지 여부.
 *
 * 웹과 앱에서 다르게 굴어야 하는 곳이 실제로 있다:
 *  · 안드로이드 하드웨어 뒤로가기 — 웹에는 없는 버튼이다
 *  · 상태바 색·안전영역 — 노치·홈 인디케이터를 피해야 한다
 *  · 푸시 — 웹은 VAPID, 앱은 APNs/FCM (채널이 다르다)
 *  · 이메일 인증·비밀번호 재설정 리다이렉트 — 앱은 딥링크로 되돌아와야 한다
 *
 * ⚠️ 이 값으로 분기할 때 **웹 쪽 동작을 망가뜨리지 않는지** 매번 확인한다.
 *    지금 실제 유저는 웹(PWA)에 있다.
 */
export const isNative = Capacitor.isNativePlatform();
export const nativePlatform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
export const isIOS = nativePlatform === 'ios';
export const isAndroid = nativePlatform === 'android';

/**
 * 네이티브 셸 초기화 — 앱에서만 돈다. 웹에서는 아무 일도 하지 않는다.
 *
 * 플러그인을 정적으로 import 하지 않고 필요할 때 불러온다.
 * 웹 번들에 안드로이드/iOS 전용 코드를 끼워 넣을 이유가 없다.
 */
export async function initNativeShell(): Promise<void> {
  if (!isNative) return;

  const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
  ]);

  // 상태바를 배경(크림/다크)과 맞춘다. 기본값으로 두면 iOS에서 흰 글씨가
  // 크림 배경 위에 얹혀 시간·배터리가 안 보인다.
  const dark = document.documentElement.classList.contains('dark');
  await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  if (isAndroid) {
    await StatusBar.setBackgroundColor({ color: dark ? '#201813' : '#F4F1EA' }).catch(() => {});
  }

  // 첫 화면이 그려진 뒤에 스플래시를 내린다(launchAutoHide: false와 짝).
  // 자동으로 내리면 React가 준비되기 전에 흰 화면이 한 번 보인다.
  await SplashScreen.hide().catch(() => {});
}

/**
 * 안드로이드 하드웨어 뒤로가기.
 *
 * 우리 오버레이는 `useBackClose`가 history를 쌓아 popstate로 닫는다.
 * Capacitor의 backButton 이벤트는 **history와 별개로** 온다 — 그냥 두면
 * 모달이 떠 있는데 앱이 그대로 종료된다.
 * 그래서 히스토리가 남아 있으면 뒤로 가고, 없을 때만 앱을 닫는다.
 */
export async function initAndroidBackButton(): Promise<void> {
  if (!isAndroid) return;
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack || window.history.length > 1) {
      window.history.back();
      return;
    }
    void App.exitApp();
  });
}
