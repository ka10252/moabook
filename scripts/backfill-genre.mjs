/**
 * 장르가 비어 있는 책 채우기 — `npm run genre:backfill`
 *
 * 장르는 등록할 때 알라딘 분류로 자동으로 정해진다. 그런데 그 기능이 생기기 전에
 * 올라온 책은 값이 없다. 그 책들을 뒤늦게 한 번 훑는다.
 *
 * 판단 순서는 앱과 **같은 함수**(src/lib/genre.ts)를 쓴다 — 규칙을 두 벌 두면
 * 나중에 한쪽만 고쳐져서 같은 책이 화면과 DB에서 다른 장르가 된다.
 *
 * 책은 주인만 고칠 수 있으므로(RLS) 쓰려면 **service_role 키**가 필요하다.
 * 키는 파일에 남기지 않는다 — 실행할 때만 넘긴다:
 *
 *   SUPABASE_SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref <ref> ...) \
 *     npm run genre:backfill
 *
 *   --dry          무엇으로 채울지만 보여주고 쓰지 않는다
 *   --reclassify   이미 장르가 있는 책까지 **다시** 매긴다 (분류 규칙을 고친 뒤에 쓴다)
 */
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
);
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
// 읽기는 anon 으로 되지만 쓰기는 RLS에 막힌다(남의 책이라서). 쓸 때만 service_role 을 쓴다.
const WRITE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || KEY;
const GKEY = env.VITE_GOOGLE_BOOKS_API_KEY || '';
const DRY = process.argv.includes('--dry');
const ALL = process.argv.includes('--reclassify');
if (!URL_ || !KEY) { console.error('.env 에 VITE_SUPABASE_URL / KEY 가 필요하다'); process.exit(1); }

const out = await build({ entryPoints: ['src/lib/genre.ts'], bundle: true, format: 'esm', write: false });
const { classifyGenre } = await import('data:text/javascript,' + encodeURIComponent(out.outputFiles[0].text));

const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const books = await (await fetch(
  `${URL_}/rest/v1/books?select=id,title,author,description,genre`
  + (ALL ? '' : '&genre=is.null'), { headers: h },
)).json();

if (!Array.isArray(books)) { console.error('책을 못 읽었다:', books); process.exit(1); }
console.log(ALL ? `전체 ${books.length}권 다시 분류\n` : `장르 없는 책 ${books.length}권\n`);

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
  } catch { /* 아래에서 구글로 한 번 더 본다 */ }

  // 알라딘은 국내도서만 본다. 영어책은 여기서 다 빈손이 되므로 구글 도서로 한 번 더 찾는다.
  if (!categoryName) {
    try {
      // 키 없이 부르면 공용 한도에 걸려 429가 온다 (실제로 겪음). .env 의 키를 쓴다.
      const g = await (await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(b.title)}&maxResults=5` +
        (GKEY ? `&key=${GKEY}` : ''),
      )).json();
      categoryName = g?.items?.find((i) => i.volumeInfo?.categories?.length)
        ?.volumeInfo.categories.join(' > ') ?? null;
    } catch { /* 그래도 없으면 제목·소개로 짐작한다 */ }
  }

  const genre = classifyGenre({ categoryName, title: b.title, description: b.description });
  const via = categoryName ? categoryName.split('>').slice(-2).join('>').trim() : '(제목 짐작)';
  const changed = b.genre && b.genre !== genre;
  console.log(`  ${changed ? '↻' : ' '} ${genre.padEnd(8)} ← ${b.title.slice(0, 30).padEnd(32)} ${via}`
    + (changed ? `   (${b.genre} 였음)` : ''));

  if (b.genre === genre) { written++; continue; }

  if (!DRY) {
    // ⚠️ return=minimal 로 두면 **RLS에 막혀 0행이 바뀌어도 204** 가 온다.
    //    실제로 "19/19 저장했다"고 찍고는 값이 하나도 안 들어간 적이 있다.
    //    바뀐 행을 돌려받아 눈으로 센다.
    const res = await fetch(`${URL_}/rest/v1/books?id=eq.${b.id}`, {
      method: 'PATCH',
      headers: { apikey: WRITE_KEY, Authorization: `Bearer ${WRITE_KEY}`,
                 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ genre }),
    });
    const rows = res.ok ? await res.json() : null;
    if (Array.isArray(rows) && rows.length === 1) written++;
    else console.log(`    ⚠️ 저장 실패 ${res.status} ${JSON.stringify(rows) || await res.text()}`);
  }
}

if (DRY) console.log('\n--dry 라 쓰지 않았다.');
else {
  console.log(`\n${written}/${books.length}권 저장했다.`);
  if (written < books.length) {
    console.log('⚠️ 못 쓴 책이 있다. SUPABASE_SERVICE_ROLE_KEY 를 넘겼는지 확인할 것 (남의 책은 RLS가 막는다).');
    process.exit(1);
  }
}
