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
