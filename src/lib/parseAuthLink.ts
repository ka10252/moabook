/**
 * 앱으로 들어온 링크에서 "무엇을 해야 하는지"만 뽑아낸다.
 *
 * supabase를 import 하지 않는 **순수 함수**로 따로 뒀다 — 그래야 브라우저 없이
 * 테스트할 수 있다(`npm run test:deeplink`). 딥링크는 실기에서만 재현되는 흐름이라
 * 파싱만이라도 자동으로 지킬 수 있어야 한다.
 */
export type AuthLink =
  | { kind: 'pkce'; path: string; code: string }
  | { kind: 'implicit'; path: string; accessToken: string; refreshToken: string }
  /** 인증 링크가 아님 — 그 화면으로 보내기만 하면 된다(초대 링크 등). null이면 무시 */
  | { kind: 'plain'; path: string | null };

export function parseAuthLink(rawUrl: string): AuthLink | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  // 앱 안에서 갈 경로.
  // 커스텀 스킴(moabook://auth/reset)은 host가 경로의 첫 조각이 된다 — pathname만 보면 놓친다.
  const path = url.protocol.startsWith('http')
    ? url.pathname
    : `/${[url.host, url.pathname.replace(/^\//, '')].filter(Boolean).join('/')}`;

  const code = url.searchParams.get('code');
  if (code) return { kind: 'pkce', path: path || '/', code };

  // implicit 흐름은 토큰이 # 뒤에 온다 — searchParams로는 안 잡힌다.
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    return { kind: 'implicit', path: path || '/', accessToken, refreshToken };
  }

  // 인증이 아닌 링크. 경로든 쿼리든 뭔가 있으면 그 화면으로 보낸다.
  // ⚠️ 초대 링크는 `https://…/?invite=TOK` 라 **경로가 '/'뿐이다.**
  //    예전엔 path === '/' 를 무시해서 앱에서 초대 링크가 먹통이었다.
  const target = `${path === '/' ? '' : path}${url.search}`;
  return { kind: 'plain', path: target || null };
}
