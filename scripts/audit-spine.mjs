/**
 * 책등 제목 잘림 검사 — `npm run audit:spine`
 *
 * 책등 제목은 세로쓰기 한 열이라 CSS만 봐서는 잘렸는지 알 수 없다.
 * 제목 span 의 `clientHeight`(보이는 영역)와 `scrollHeight`(실제 글자 길이)를 비교한다.
 * scrollHeight 가 더 크면 그 책은 잘린 것이다 — BookSpine 의 상수를 다시 재야 한다.
 *
 * '…'로 끝나는 제목은 **일부러** 자른 것이다(가장 긴 책등으로도 안 담기는 제목).
 * 그건 실패가 아니라 설계이므로 따로 센다.
 */
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH
  || `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const BASE = process.env.MOA_URL || 'http://localhost:8081';
const EMAIL = process.env.MOA_EMAIL, PW = process.env.MOA_PW;

const b = await chromium.launch({ executablePath: CHROME });
const p = await b.newPage({ viewport: { width: 420, height: 900 } });

if (EMAIL && PW) {
  await p.goto(`${BASE}/auth`, { waitUntil: 'networkidle' });
  await p.locator('input[type="email"]').first().fill(EMAIL);
  await p.locator('input[type="password"]').first().fill(PW);
  await p.getByRole('button', { name: /로그인/ }).first().click();
  await p.waitForTimeout(4500);
} else {
  console.log('ℹ️  MOA_EMAIL / MOA_PW 가 없으면 예시 책만 검사한다.');
}
await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
await p.getByRole('button', { name: /알겠어요/ }).first().click().catch(() => {});
await p.waitForTimeout(800);

const rows = await p.evaluate(() =>
  [...document.querySelectorAll('span[title]')]
    .filter((sp) => getComputedStyle(sp).writingMode === 'vertical-lr')
    .map((sp) => ({
      title: sp.getAttribute('title'),
      shown: sp.innerText.replace(/\n/g, ''),
      clientH: sp.clientHeight,
      scrollH: sp.scrollHeight,
    })),
);

const clipped = rows.filter((r) => r.scrollH > r.clientH + 1 && !r.shown.endsWith('…'));
const ellipsis = rows.filter((r) => r.shown.endsWith('…'));

console.log(`책등 ${rows.length}개 검사`);
if (ellipsis.length) {
  console.log(`\n… 로 줄인 책 ${ellipsis.length}권 (의도한 동작 — 가장 긴 책등에도 안 담김)`);
  ellipsis.forEach((r) => console.log(`   ${r.title.slice(0, 40)}`));
}
if (clipped.length) {
  console.log(`\n❌ 계산은 "들어간다"고 했는데 실제로 잘린 책 ${clipped.length}권:`);
  clipped.forEach((r) => console.log(`   ${r.title.slice(0, 34).padEnd(36)} 영역 ${r.clientH}px < 글자 ${r.scrollH}px (${r.scrollH - r.clientH}px 넘침)`));
  console.log('\n→ src/components/BookSpine.tsx 의 SPAN_MAX_PX / PER_UNIT_PX / SAFETY_PX 를 다시 잴 것.');
  await b.close();
  process.exit(1);
}
console.log('\n✅ 잘린 책 없음 — 담기는 제목은 모두 끝까지 보인다.');
await b.close();
