/**
 * 배지 조건 SQL 생성 — `award_badges()`의 WHERE 절을 `BADGE_META`에서 뽑아 찍는다.
 *
 * 왜 필요한가: 배지 조건이 두 곳에 있었다. 판정은 `award_badges()` SQL, 화면 문구는
 * `BADGE_META`. 한쪽만 고치면 **화면에 적힌 조건과 실제 발급 기준이 달라지는데,
 * 아무 에러도 안 난다.** 그래서 임계값의 단일 출처를 `BADGE_META`로 두고,
 * SQL은 여기서 만들어 붙인다.
 *
 * 사용법:
 *   npm run badges:sql                 # 현재 기준으로 SQL 출력
 *   npm run badges:sql -- --check      # 최신 마이그레이션과 다르면 실패(exit 1)
 *
 * 기준을 바꿀 땐 `src/components/BadgeStamp.tsx`의 tiers만 고치고, 출력된 블록을
 * 새 마이그레이션에 붙인다.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'src/components/BadgeStamp.tsx';
const MIGRATIONS = 'supabase/migrations';

/** BadgeStamp.tsx는 TSX라 import할 수 없다 — BADGE_META 리터럴만 뜯어 읽는다 */
function readMeta() {
  const src = readFileSync(SRC, 'utf8');
  const start = src.indexOf('export const BADGE_META: BadgeMeta[] = [');
  if (start < 0) throw new Error(`${SRC} 에서 BADGE_META를 못 찾았다`);
  // ⚠️ 첫 '['는 타입 주석의 `BadgeMeta[]`다. 배열 리터럴은 '= [' 뒤에 있다.
  const open = src.indexOf('[', src.indexOf('= [', start) + 1);
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  const body = src.slice(open, end);

  const out = [];
  for (const m of body.matchAll(/\{\s*id:\s*'([^']+)'[\s\S]*?tiers:\s*\[([^\]]*)\][\s\S]*?sqlVar:\s*'([^']*)'/g)) {
    out.push({
      id: m[1],
      tiers: m[2].split(',').map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n)),
      sqlVar: m[3],
    });
  }
  if (!out.length) throw new Error('BADGE_META 파싱 실패');
  return out;
}

/** 임계값 → CASE/WHERE 한 줄 */
function line(b) {
  if (b.id === 'elder') {
    return `    UNION ALL SELECT 'elder',     0  WHERE v_created::date <= v_launch + 14`;
  }
  const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
  const key = pad(`'${b.id}',`, 11);
  if (b.tiers.length === 1) {
    return `    UNION ALL SELECT ${key} 0  WHERE ${b.sqlVar} >= ${b.tiers[0]}`;
  }
  const [t1, t2, t3] = b.tiers;
  return `    UNION ALL SELECT ${key} CASE WHEN ${b.sqlVar} >= ${t3} THEN 3 WHEN ${b.sqlVar} >= ${t2} THEN 2 ELSE 1 END WHERE ${b.sqlVar} >= ${t1}`;
}

const meta = readMeta();
const lines = meta.map(line);
// 첫 줄은 UNION ALL 없이 시작한다
lines[0] = lines[0].replace('    UNION ALL SELECT', '                    SELECT');
const block = `  WITH q(k, t) AS (\n${lines.join('\n')}\n  ),`;

/** 주석·공백을 걷어내고 `'id' … WHERE …` 절만 뽑는다 — 서식이 달라도 뜻이 같으면 통과 */
function clauses(sql) {
  const noComments = sql.replace(/--[^\n]*/g, ' ');
  const out = new Map();
  for (const m of noComments.matchAll(/SELECT\s+'([a-z_]+)',\s*([\s\S]*?)\s+WHERE\s+([\s\S]*?)(?=\s+UNION ALL SELECT|\s*\)\s*,)/g)) {
    out.set(m[1], `${m[2].replace(/\s+/g, ' ').trim()} | ${m[3].replace(/\s+/g, ' ').trim()}`);
  }
  return out;
}

if (process.argv.includes('--check')) {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  const latest = files.filter((f) => readFileSync(join(MIGRATIONS, f), 'utf8').includes('WITH q(k, t) AS')).pop();
  if (!latest) { console.error('❌ award_badges()가 든 마이그레이션을 못 찾았다'); process.exit(1); }

  const want = clauses(block);
  const got = clauses(readFileSync(join(MIGRATIONS, latest), 'utf8'));
  const diffs = [];
  for (const [id, rule] of want) {
    if (!got.has(id)) diffs.push(`  - ${id}: 마이그레이션에 없음 (BADGE_META에는 있다)`);
    else if (got.get(id) !== rule) diffs.push(`  - ${id}\n      BADGE_META: ${rule}\n      마이그레이션: ${got.get(id)}`);
  }
  for (const id of got.keys()) if (!want.has(id)) diffs.push(`  - ${id}: BADGE_META에 없음 (마이그레이션에는 있다)`);

  if (!diffs.length) {
    console.log(`✅ ${latest} 의 배지 조건이 BADGE_META와 일치한다 (${want.size}종)`);
    process.exit(0);
  }
  console.error(`❌ ${latest} 와 BADGE_META가 다르다:\n${diffs.join('\n')}\n\n새 마이그레이션에 붙일 SQL은 \`npm run badges:sql\` 로 얻는다.`);
  process.exit(1);
}

console.log('-- BADGE_META(src/components/BadgeStamp.tsx)에서 생성됨. 손으로 고치지 말 것.');
console.log(block);
