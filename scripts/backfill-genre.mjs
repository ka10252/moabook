/**
 * 장르가 비어 있는 책 채우기 — `npm run genre:backfill`
 *
 * 장르는 등록할 때 알라딘 분류로 자동으로 정해진다. 그런데 그 기능이 생기기 전에
 * 올라온 책은 값이 없다. 그 책들을 뒤늦게 한 번 훑는다.
 *
 * 판단 순서는 앱과 **같은 함수**(src/lib/genre.ts)를 쓴다 — 규칙을 두 벌 두면
 * 나중에 한쪽만 고쳐져서 같은 책이 화면과 DB에서 다른 장르가 된다.
 *
 *   --dry   무엇으로 채울지만 보여주고 쓰지 않는다
 */
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
);
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const DRY = process.argv.includes('--dry');
if (!URL_ || !KEY) { console.error('.env 에 VITE_SUPABASE_URL / KEY 가 필요하다'); process.exit(1); }

const out = await build({ entryPoints: ['src/lib/genre.ts'], bundle: true, format: 'esm', write: false });
const { classifyGenre } = await import('data:text/javascript,' + encodeURIComponent(out.outputFiles[0].text));

const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const books = await (await fetch(
  `${URL_}/rest/v1/books?select=id,title,author,description&genre=is.null`, { headers: h },
)).json();

if (!Array.isArray(books)) { console.error('책을 못 읽었다:', books); process.exit(1); }
console.log(`장르 없는 책 ${books.length}권\n`);

let written = 0;
for (const b of books) {
  // 알라딘 분류가 가장 정확하다. 제목으로 다시 찾아 첫 결과의 분류를 쓴다.
  // (등록 시점엔 검색 결과가 손에 있지만, 지난 책은 이 방법밖에 없다)
  let categoryName = null;
  try {
    const r = await (await fetch(`${URL_}/functions/v1/aladin-search`, {
      method: 'POST', headers: h, body: JSON.stringify({ query: b.title }),
    })).json();
    categoryName = r?.results?.[0]?.categoryName ?? null;
  } catch { /* 못 찾으면 제목·소개로 짐작한다 */ }

  const genre = classifyGenre({ categoryName, title: b.title, description: b.description });
  const via = categoryName ? categoryName.split('>').slice(1, 3).join('>') : '(제목 짐작)';
  console.log(`  ${genre.padEnd(8)} ← ${b.title.slice(0, 30).padEnd(32)} ${via}`);

  if (!DRY) {
    const res = await fetch(`${URL_}/rest/v1/books?id=eq.${b.id}`, {
      method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ genre }),
    });
    if (res.ok) written++;
    else console.log(`    ⚠️ 저장 실패 ${res.status} ${await res.text()}`);
  }
}

console.log(DRY ? '\n--dry 라 쓰지 않았다.' : `\n${written}/${books.length}권 저장했다.`);
