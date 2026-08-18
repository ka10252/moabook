/**
 * 딥링크 파싱 테스트.
 *
 * 왜 필요한가: 인증 메일 링크로 앱이 열리는 흐름은 **실기에서만 재현된다.**
 * 시뮬레이터도 메일 앱이 없어 확인이 번거롭다. 최소한 "어떤 주소가 오면
 * 무엇으로 해석되는가"는 자동으로 지킨다.
 *
 * ⚠️ 파서를 복사하지 않는다 — 실제 소스(`src/lib/parseAuthLink.ts`)를 그때그때
 *    트랜스파일해서 부른다. 복사본을 두면 한쪽만 고쳐져 조용히 어긋난다.
 *
 *   npm run test:deeplink
 */
import { buildSync } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = buildSync({
  entryPoints: ['src/lib/parseAuthLink.ts'],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'neutral',
});
const dir = mkdtempSync(join(tmpdir(), 'moa-dl-'));
const file = join(dir, 'parseAuthLink.mjs');
writeFileSync(file, out.outputFiles[0].text);
const { parseAuthLink } = await import(file);

const SITE = 'https://moabook.app';
const CASES = [
  ['가입 확인 · PKCE',        `${SITE}/auth?code=abc123`,                        { kind: 'pkce', path: '/auth' }],
  ['비밀번호 재설정 · PKCE',   `${SITE}/auth/reset?code=xyz`,                     { kind: 'pkce', path: '/auth/reset' }],
  ['가입 확인 · implicit',    `${SITE}/auth#access_token=A&refresh_token=B`,     { kind: 'implicit', path: '/auth' }],
  ['커스텀 스킴 · PKCE',      'moabook://auth?code=abc',                         { kind: 'pkce', path: '/auth' }],
  ['커스텀 스킴 · 재설정',     'moabook://auth/reset?code=abc',                   { kind: 'pkce', path: '/auth/reset' }],
  ['커스텀 스킴 · implicit',  'moabook://auth#access_token=A&refresh_token=B',   { kind: 'implicit', path: '/auth' }],
  // 초대 링크는 경로가 '/' 뿐이라 예전에 무시됐다 — 앱에서 초대가 먹통이었다
  ['초대 링크',               `${SITE}/?invite=TOK`,                             { kind: 'plain', path: '?invite=TOK' }],
  ['커뮤니티 딥링크',          'moabook://space/community/123',                   { kind: 'plain', path: '/space/community/123' }],
  ['홈으로만',                `${SITE}/`,                                        { kind: 'plain', path: null }],
  ['깨진 URL',               'not a url',                                        null],
];

let pass = 0;
for (const [name, input, want] of CASES) {
  const got = parseAuthLink(input);
  const ok =
    want === null
      ? got === null
      : !!got && got.kind === want.kind && got.path === want.path;
  if (!ok) {
    console.log(`❌ ${name}\n   입력: ${input}\n   기대: ${JSON.stringify(want)}\n   실제: ${JSON.stringify(got)}`);
  } else {
    console.log(`✅ ${name}`);
    pass++;
  }
}
console.log(`\n${pass}/${CASES.length} 통과`);
process.exit(pass === CASES.length ? 0 : 1);
