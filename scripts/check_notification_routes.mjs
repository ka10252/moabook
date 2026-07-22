/**
 * DB가 만들어내는 모든 알림 타입이 화면에 연결돼 있는지 검사한다.
 *
 * 왜 필요한가:
 *   알림을 눌렀는데 아무 일도 안 일어나면 유저는 다음부터 알림을 안 누른다.
 *   그런데 새 알림을 DB에 추가하고 라우팅표에 추가하는 걸 잊어도 아무 에러가 안 난다.
 *   조용히 죽은 링크가 된다. 그걸 여기서 잡는다.
 *
 * 쓰는 법:  npm run check:notifications
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ── 1. DB의 알림 생성 함수들이 INSERT 하는 type 값을 전부 긁어온다
// SQL은 따옴표가 많아 셸 인용이 깨진다. 파일로 넘긴다.
const tmpFile = join(mkdtempSync(join(tmpdir(), 'moa-')), 'q.sql');
writeFileSync(
  tmpFile,
  "SELECT string_agg(pg_get_functiondef(oid), ' ') AS defs FROM pg_proc\n" +
    "WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'notify%';\n"
);
let raw;
try {
  raw = execSync(`supabase db query --linked --agent=no -o json -f ${tmpFile}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
} finally {
  unlinkSync(tmpFile);
}
const defs = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1))[0].defs ?? '';

// notif_type := 'xxx'  또는  INSERT ... VALUES (user, 'xxx', ...)
const dbTypes = new Set();
for (const m of defs.matchAll(/notif_type\s*:=\s*'([a-z_]+)'/g)) dbTypes.add(m[1]);
for (const m of defs.matchAll(/VALUES\s*\(\s*[\w.]+,\s*'([a-z_]+)'/g)) dbTypes.add(m[1]);

// ── 2. 앱의 라우팅표를 읽는다
const routesSrc = readFileSync(new URL('../src/lib/notificationRoutes.ts', import.meta.url), 'utf8');
const routed = new Map();
for (const m of routesSrc.matchAll(/^\s{2}([a-z_]+):\s*\{\s*destination:\s*'(\w+)',\s*label:\s*'([^']+)'/gm)) {
  routed.set(m[1], { destination: m[2], label: m[3] });
}

// ── 3. 대조
const missing = [...dbTypes].filter((t) => !routed.has(t)).sort();
const unused = [...routed.keys()].filter((t) => !dbTypes.has(t) && t !== 'chat').sort();

const DEST_KO = {
  chat: '채팅방',
  book: '책 상세',
  transactions: '거래 현황',
  community: '커뮤니티 탭',
};

console.log('\n알림 → 화면 연결표\n');
console.log('┌──────────────────────┬────────────────────────────┬──────────────┐');
console.log('│ 알림 타입            │ 설명                       │ 눌렀을 때    │');
console.log('├──────────────────────┼────────────────────────────┼──────────────┤');
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - [...s].reduce((w, c) => w + (c.charCodeAt(0) > 0x1100 ? 2 : 1), 0)));
for (const [type, r] of [...routed].sort((a, b) => a[1].destination.localeCompare(b[1].destination))) {
  const live = dbTypes.has(type) ? ' ' : '·'; // ·는 DB가 아직 안 만드는 타입
  console.log(`│${live}${pad(type, 21)}│ ${pad(r.label, 27)}│ ${pad(DEST_KO[r.destination], 13)}│`);
}
console.log('└──────────────────────┴────────────────────────────┴──────────────┘');

if (missing.length) {
  console.error(`\n❌ 죽은 링크: DB는 만드는데 연결이 없는 알림 ${missing.length}개`);
  for (const t of missing) console.error(`   - ${t}  → src/lib/notificationRoutes.ts 에 추가하세요`);
  process.exit(1);
}
console.log(`\n✅ DB가 만드는 알림 ${dbTypes.size}종이 모두 화면에 연결돼 있습니다.`);
if (unused.length) console.log(`ℹ️  라우팅표에만 있는 타입 (DB 미사용): ${unused.join(', ')}`);
