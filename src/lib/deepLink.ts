import { supabase } from '@/integrations/supabase/client';
import { isNative } from './native';
import { parseAuthLink } from './parseAuthLink';

/**
 * 앱으로 들어온 링크를 처리한다 (F11).
 *
 * 메일의 인증 링크는 웹 주소(`https://<사이트>/auth?...`)다. 앱이 깔려 있으면
 * OS가 App Links(Android)·Universal Links(iOS)로 **웹 대신 앱을 연다.**
 * 그때 우리가 직접 토큰을 꺼내 세션을 만들어야 한다 — 앱에는 그 주소를
 * 대신 처리해 줄 브라우저가 없다.
 *
 * 링크 파싱은 `parseAuthLink`(순수 함수)가 맡는다 — 테스트가 가능하도록 분리했다.
 * 여기서는 그 결과로 세션을 만드는 일만 한다.
 */
type Navigate = (path: string) => void;

/** 링크에서 인증 정보를 꺼내 세션을 만든다. 앱 안에서 갈 경로를 돌려준다(없으면 null). */
export async function consumeAuthLink(rawUrl: string): Promise<string | null> {
  const link = parseAuthLink(rawUrl);
  if (!link) return null;

  if (link.kind === 'pkce') {
    const { error } = await supabase.auth.exchangeCodeForSession(link.code);
    if (error) console.error('[deeplink] 코드 교환 실패', error.message);
    return link.path;
  }

  if (link.kind === 'implicit') {
    const { error } = await supabase.auth.setSession({
      access_token: link.accessToken,
      refresh_token: link.refreshToken,
    });
    if (error) console.error('[deeplink] 세션 복원 실패', error.message);
    return link.path;
  }

  return link.path;
}

/**
 * 앱이 링크로 열릴 때를 듣는다.
 *
 * ⚠️ 앱이 **꺼져 있다가** 링크로 켜진 경우도 있다. 그때는 이벤트가 이미 지나갔을 수 있어
 *    `getLaunchUrl()`로 시작 주소를 한 번 더 확인한다. 이걸 빠뜨리면
 *    "앱이 꺼져 있을 때 누른 인증 메일만 안 먹는" 재현하기 어려운 버그가 된다.
 */
export async function initDeepLinks(navigate: Navigate): Promise<() => void> {
  if (!isNative) return () => {};
  const { App } = await import('@capacitor/app');

  const handle = async (url: string) => {
    // 딥링크는 실기에서만 도는 흐름이라, 들어온 주소와 결정된 경로를 남긴다.
    // capacitor.config의 loggingBehavior: 'debug' 덕에 네이티브 로그로 보인다.
    console.log('[deeplink] 받음:', url);
    const path = await consumeAuthLink(url);
    console.log('[deeplink] 이동:', path ?? '(없음)');
    if (path) navigate(path);
  };

  const launch = await App.getLaunchUrl();
  if (launch?.url) void handle(launch.url);

  const sub = await App.addListener('appUrlOpen', ({ url }) => void handle(url));
  return () => void sub.remove();
}
