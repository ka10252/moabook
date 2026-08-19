/**
 * 표지색 채우기 — `npm run hue:backfill`
 *
 * 책등 색은 표지에서 뽑은 색상(H)으로 만든다. 그 값은 등록할 때 한 번 재서 넣는데,
 * 이 기능이 생기기 전에 올라온 책은 비어 있다. 그 책들을 한 번 훑는다.
 *
 * ⚠️ 색을 뽑는 규칙은 **앱과 같은 함수**(src/lib/coverColor.ts)를 쓴다.
 *    캔버스가 필요해서 Node 로는 못 돌린다 → 실제 브라우저를 띄워 앱 코드를 그대로 부른다.
 *    규칙을 두 벌 두면 나중에 한쪽만 고쳐져 같은 책이 화면과 DB에서 다른 색이 된다.
 *
 * 남의 책도 고쳐야 하므로 service_role 키가 필요하다:
 *   SUPABASE_SERVICE_ROLE_KEY=… npm run hue:backfill [-- --dry] [-- --all]
 */
import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
);
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const WRITE = process.env.SUPABASE_SERVICE_ROLE_KEY || KEY;
const DRY = process.argv.includes('--dry');
const ALL = process.argv.includes('--all');
const CHROME = process.env.CHROME_PATH
  || `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const books = await (await fetch(
  `${URL_}/rest/v1/books?select=id,title,cover_url,cover_hue` + (ALL ? '' : '&cover_hue=is.null'),
  { headers: h },
)).json();
if (!Array.isArray(books)) { console.error('책을 못 읽었다:', books); process.exit(1); }
console.log(`${ALL ? '전체' : '색 없는 책'} ${books.length}권\n`);

// 앱의 추출 함수를 그대로 브라우저에 넣는다
const bundle = (await build({
  entryPoints: ['src/lib/coverColor.ts'], bundle: true, format: 'iife',
  globalName: 'CoverColor', write: false,
})).outputFiles[0].text;

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.goto('about:blank');
await page.addScriptTag({ content: bundle });

let written = 0, failed = 0;
for (const b of books) {
  const hue = b.cover_url
    ? await page.evaluate((u) => window.CoverColor.extractCoverHue(u), b.cover_url).catch(() => null)
    : null;
  const same = b.cover_hue === hue;
  console.log(`  ${hue == null ? '  —' : String(hue).padStart(3)}°  ${(b.title || '').slice(0, 30)}`
    + (hue == null ? '   (표지 없음·무채색 → 기본 팔레트)' : ''));
  if (hue == null) failed++;
  if (same || DRY || hue == null) continue;

  // ⚠️ return=minimal 은 RLS에 막혀 0행이어도 204다. 바뀐 행을 돌려받아 센다.
  const res = await fetch(`${URL_}/rest/v1/books?id=eq.${b.id}`, {
    method: 'PATCH',
    headers: { apikey: WRITE, Authorization: `Bearer ${WRITE}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ cover_hue: hue }),
  });
  const rows = res.ok ? await res.json() : null;
  if (Array.isArray(rows) && rows.length === 1) written++;
  else console.log(`      ⚠️ 저장 실패 ${res.status} ${JSON.stringify(rows) ?? await res.text()}`);
}
await browser.close();

console.log(`\n색을 못 뽑은 책 ${failed}권 (기본 팔레트로 표시된다)`);
console.log(DRY ? '--dry 라 쓰지 않았다.' : `${written}권 저장했다.`);
