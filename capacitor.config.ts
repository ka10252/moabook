import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 네이티브 셸 설정 (F11).
 *
 * 지금 웹앱(Vite + React + Phaser)을 그대로 iOS/Android 셸에 담는다.
 * React Native로 옮기는 건 전면 재작성이라 해당 없다.
 */
const config: CapacitorConfig = {
  appId: 'app.moabook',
  appName: '모아북',
  webDir: 'dist',

  // 앱 안에서는 http(s)가 아니라 capacitor:// 로 페이지가 열린다.
  // Supabase는 CORS로 막지 않지만, 리다이렉트가 걸리는 흐름(이메일 인증·비밀번호 재설정)은
  // 웹 주소로 돌아오므로 딥링크로 다시 앱에 들여보내야 한다 → docs/NATIVE_APP.md 참고.
  server: {
    androidScheme: 'https',
  },

  /**
   * 'debug' = Debug 빌드에서만 로그를 남긴다(Capacitor 기본값). 스토어 배포본에는 안 나간다.
   *
   * 웹뷰의 console.log는 `xcrun simctl launch --console-pty` 에 `⚡️ [log] -` 로 나온다.
   * (아래 ios.webContentsDebuggingEnabled 와 함께 켜야 보인다)
   */
  loggingBehavior: 'debug',

  ios: {
    /**
     * Safari 웹 인스펙터로 웹뷰를 들여다볼 수 있게 한다.
     *
     * 왜 명시해야 하나: Capacitor는 Debug 빌드면 자동으로 켜는데, 그 판단이
     * `#if DEBUG`다. **Capacitor 8은 SPM xcframework로 들어와서** 그 매크로가
     * 우리 앱이 아니라 **프레임워크의 빌드 설정**을 본다 → 항상 거짓이 된다.
     * (CAPInstanceDescriptor.swift 의 else 분기 주석에 그 사정이 적혀 있다)
     * 그래서 Safari '개발자용' 메뉴에 기기가 아예 안 뜬다.
     *
     * ⚠️ **스토어 배포 전에 반드시 false로 되돌리거나 Debug 전용으로 바꾼다.**
     *    켜둔 채로 내보내면 배포본의 웹뷰를 누구나 들여다볼 수 있다.
     *    docs/STORE_RELEASE_CHECKLIST.md 에 항목으로 넣어뒀다.
     */
    webContentsDebuggingEnabled: true,
  },

  plugins: {
    SplashScreen: {
      // 스플래시를 코드에서 직접 내린다. 자동으로 내리면 React가 첫 화면을 그리기 전에
      // 흰 화면이 잠깐 보인다 — PWA에서 이미 겪은 문제다.
      launchAutoHide: false,
      backgroundColor: '#F4F1EA',
      showSpinner: false,
    },
    Keyboard: {
      // 키보드가 올라올 때 웹뷰를 밀지 않고 덮게 둔다. 밀면 하단 탭바가 같이 올라와
      // 게시판·채팅 입력 중에 탭바가 화면 중간에 뜬다.
      resize: 'none',
    },
  },
};

export default config;
