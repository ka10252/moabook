import { isNative } from './native';

/**
 * 인증 메일(가입 확인·비밀번호 재설정)이 돌아올 주소.
 *
 * 웹에서는 지금 열려 있는 주소를 그대로 쓰면 된다. **앱에서는 안 된다.**
 * 앱은 `capacitor://localhost`(iOS) 또는 `https://localhost`(Android)에서 도는데,
 * 그 주소는 메일 클라이언트가 열 수 없고 Supabase 허용 목록에도 넣을 수 없다.
 *
 * 그래서 앱에서는 **실제 웹 주소**를 넘긴다. 그러면
 *  · 앱이 깔려 있으면 → OS가 App Links/Universal Links로 앱을 연다
 *  · 안 깔려 있으면   → 웹앱이 열린다 (막다른 길이 아니다)
 *
 * ⚠️ 네이티브 빌드에는 `VITE_PUBLIC_SITE_URL`이 **반드시** 필요하다.
 *    없으면 인증 메일 링크가 앱으로 돌아오지 못해 가입을 끝낼 수 없다.
 */
const SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(/\/$/, '');

export function authRedirectTo(path: string): string {
  if (!isNative) return `${window.location.origin}${path}`;
  if (!SITE_URL) {
    // 조용히 넘어가면 "메일은 왔는데 눌러도 아무 일이 없는" 상태가 된다. 크게 남긴다.
    console.error(
      '[auth] VITE_PUBLIC_SITE_URL이 없다. 네이티브 빌드에서는 인증 메일이 앱으로 돌아오지 못한다.',
    );
    return `${window.location.origin}${path}`;
  }
  return `${SITE_URL}${path}`;
}
