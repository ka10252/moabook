/**
 * 끝난 대여의 반납일 채우기 — `npm run returndate:backfill`
 *
 * `return_date` 는 원래 '반납 예정일'만 담았다. 예정일을 안 정하고 빌려준 거래는
 * 반납이 끝났는데도 거래 현황에 "반납일: 미정"으로 남는다.
 * 반납을 확인하면 채팅에 `[반납 완료] … [BOOK_ID:…]` 가 남으므로 그 시각을 쓴다.
 *
 * 왜 SQL 마이그레이션이 아닌가: `UPDATE … FROM LATERAL` 로 같은 일을 시도했는데
 * 한 행도 바뀌지 않았다. 조용히 0행인 SQL은 확인할 방법이 없다.
 * 스크립트는 무엇을 어디에 넣었는지 한 줄씩 찍어 눈으로 확인할 수 있다.
 *
 * 책을 여러 번 빌린 경우가 있어(같은 책에 완료 거래가 3건) 시간 순으로 **한 번 쓴
 * 메시지는 다시 쓰지 않고** 짝을 맞춘다.
 *
 * 남의 거래도 고쳐야 하므로 service_role 키가 필요하다. 파일에 남기지 않는다:
 *   SUPABASE_SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref <ref> …) \
 *     npm run returndate:backfill
 *
 *   --dry   무엇을 넣을지만 보여주고 쓰지 않는다
 */
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
);
const URL_ = env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const DRY = process.argv.includes('--dry');
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const get = async (path) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: h });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error(`읽기 실패 ${path}: ${JSON.stringify(j)}`);
  return j;
};

const txs = await get('transactions?select=id,book_id,start_date,created_at,return_date,status,type,book:books(title)&status=eq.completed&type=eq.rent&order=start_date.asc');
const msgs = await get("messages?select=content,created_at&content=like.*%EB%B0%98%EB%82%A9%20%EC%99%84%EB%A3%8C*&order=created_at.asc");

// 책별 '반납 완료' 시각 목록
const byBook = new Map();
for (const m of msgs) {
  const id = /\[BOOK_ID:([^\]]+)\]/.exec(m.content)?.[1];
  if (!id) continue;
  if (!byBook.has(id)) byBook.set(id, []);
  byBook.get(id).push(m.created_at);
}

console.log(`끝난 대여 ${txs.length}건 / '반납 완료' 메시지 ${msgs.length}건\n`);

const used = new Set();
let written = 0, matched = 0, skipped = 0;

for (const t of txs) {
  const title = (t.book?.title ?? '?').slice(0, 22);
  const from = t.start_date ?? t.created_at;
  // 이 거래의 대여 시작 이후, 아직 다른 거래에 쓰이지 않은 가장 이른 메시지
  const hit = (byBook.get(t.book_id) ?? []).find(ts => ts >= from && !used.has(`${t.book_id}|${ts}`));

  if (!hit) {
    skipped++;
    console.log(`  — ${title.padEnd(24)} 대여 ${String(from).slice(0, 10)} → 맞는 '반납 완료' 메시지 없음 (그대로 둠)`);
    continue;
  }
  used.add(`${t.book_id}|${hit}`);
  matched++;
  const same = t.return_date === hit;
  console.log(`  ${same ? '=' : '→'} ${title.padEnd(24)} 대여 ${String(from).slice(0, 10)} → 반납 ${hit.slice(0, 10)}`
    + (t.return_date && !same ? `  (예정일 ${t.return_date.slice(0, 10)} 였음)` : ''));
  if (same || DRY) continue;

  // ⚠️ return=minimal 은 RLS에 막혀 0행이어도 204다. 바뀐 행을 돌려받아 센다.
  const res = await fetch(`${URL_}/rest/v1/transactions?id=eq.${t.id}`, {
    method: 'PATCH', headers: { ...h, Prefer: 'return=representation' },
    body: JSON.stringify({ return_date: hit }),
  });
  const rows = res.ok ? await res.json() : null;
  if (Array.isArray(rows) && rows.length === 1) written++;
  else console.log(`      ⚠️ 저장 실패 ${res.status} ${JSON.stringify(rows) ?? await res.text()}`);
}

console.log(`\n짝 맞춤 ${matched}건 · 메시지 없어 건너뜀 ${skipped}건`);
console.log(DRY ? '--dry 라 쓰지 않았다.' : `${written}건 저장했다.`);
