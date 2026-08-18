/**
 * HTML 엔티티 해제 검사 — `npm run test:decode`
 *
 * 왜 남기나: 알라딘/구글이 준 `&quot;` 가 화면에 그대로 나왔고, 그대로 등록하면
 * **DB에 박힌다**. 소스가 늘 때마다 다시 샐 자리라 회귀 검사로 고정해둔다.
 * 실제 소스 파일을 그대로 트랜스파일해서 검사한다 — 복사본을 두면 원본과 어긋난다.
 */
import { build } from 'esbuild';

const out = await build({
  entryPoints: ['src/lib/decodeEntities.ts'],
  bundle: true, format: 'esm', write: false,
});
const { decodeEntities } = await import(
  'data:text/javascript,' + encodeURIComponent(out.outputFiles[0].text)
);

const CASES = [
  ['&quot;나는 맞고 너는 틀리다&quot; - ‘신이 죽은’ 시대', '"나는 맞고 너는 틀리다" - ‘신이 죽은’ 시대'],
  ['Tom &amp; Jerry', 'Tom & Jerry'],
  ['&amp;quot;이중 인코딩&amp;quot;', '"이중 인코딩"'],
  ['R&amp;D &amp; Co', 'R&D & Co'],          // 원문의 & 는 살아 있어야 한다
  ['&#39;홑따옴표&#39;', "'홑따옴표'"],
  ['&#x2018;유니코드 참조&#x2019;', '‘유니코드 참조’'],
  ['&lt;script&gt;', '<script>'],            // 텍스트로 되돌릴 뿐, 실행되지 않는다
  ['엔티티 없음', '엔티티 없음'],
  ['&unknown; 는 그대로', '&unknown; 는 그대로'],
];

let pass = 0;
for (const [input, expected] of CASES) {
  const got = decodeEntities(input);
  const ok = got === expected;
  pass += ok;
  console.log(`${ok ? '✓' : '✗'} ${JSON.stringify(input)} → ${JSON.stringify(got)}` +
    (ok ? '' : `  (기대: ${JSON.stringify(expected)})`));
}
console.log(`\n${pass}/${CASES.length}`);
process.exit(pass === CASES.length ? 0 : 1);
