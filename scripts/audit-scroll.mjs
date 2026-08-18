/**
 * 스크롤 갇힘 검사 — `npm run audit:scroll`
 *
 * "내용이 넘치는데 스크롤이 안 되는" 화면을 찾는다. 실제로 두 번 겪었다:
 *   · 알림 팝업 — Radix ScrollArea 의 viewport 가 h-full 을 못 물고 내용만큼 자랐다
 *   · 커뮤니티 책장 — 겉 상자에 높이가 안 잡혀 있었다
 * CSS만 봐서는 안 보이고, 화면을 열어 clientHeight/scrollHeight 를 재야 알 수 있다.
 *
 * 판정: 넘치는(scrollHeight > clientHeight) 요소인데 overflow 가 hidden 이면 갇힌 것이다.
 */
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH
  || `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const BASE = process.env.MOA_URL || 'http://localhost:8081';
const EMAIL = process.env.MOA_EMAIL, PW = process.env.MOA_PW;
if (!EMAIL || !PW) { console.log('ℹ️  MOA_EMAIL / MOA_PW 가 필요하다 (팝업은 로그인 후에만 열린다).'); process.exit(0); }

const b = await chromium.launch({ executablePath: CHROME });
const p = await b.newPage({ viewport: { width: 420, height: 900 } });

const trapped = () => p.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('div, section, main, ul')) {
    const over = el.scrollHeight - el.clientHeight;
    if (over < 24 || el.clientHeight < 80) continue;      // 몇 px 차이는 반올림·그림자 몫
    const st = getComputedStyle(el);
    if (st.overflowY === 'auto' || st.overflowY === 'scroll') continue;   // 스크롤됨 — 정상
    if (st.overflowY === 'visible') continue;             // 부모가 스크롤한다
    out.push({
      cls: (el.className || '').toString().slice(0, 70),
      clientH: el.clientHeight, scrollH: el.scrollHeight, overflowY: st.overflowY,
    });
  }
  return out;
});

await p.goto(`${BASE}/auth`, { waitUntil: 'networkidle' });
await p.locator('input[type="email"]').first().fill(EMAIL);
await p.locator('input[type="password"]').first().fill(PW);
await p.getByRole('button', { name: /로그인/ }).first().click();
await p.waitForTimeout(4500);
await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
await p.getByRole('button', { name: /알겠어요/ }).first().click().catch(() => {});
await p.waitForTimeout(600);

const openers = [
  ['알림 팝업', async () => {
    const bs = p.locator('header button');
    for (let i = 0; i < await bs.count(); i++) {
      if (/lucide-bell/.test(await bs.nth(i).innerHTML())) { await bs.nth(i).click({ force: true }); return true; }
    }
    return false;
  }],
  ['공지 팝업', async () => {
    const bs = p.locator('header button');
    for (let i = 0; i < await bs.count(); i++) {
      if (/lucide-mail/.test(await bs.nth(i).innerHTML())) { await bs.nth(i).click({ force: true }); return true; }
    }
    return false;
  }],
  ['좋아요한 책', async () => p.getByRole('button', { name: /좋아요|관심/ }).first().click({ force: true }).then(() => true).catch(() => false)],
  ['거래 현황', async () => p.getByText('거래 현황').first().click({ force: true }).then(() => true).catch(() => false)],
];

let bad = 0;
for (const [name, open] of openers) {
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  if (!await open()) { console.log(`  — ${name}: 열지 못했다 (건너뜀)`); continue; }
  await p.waitForTimeout(1500);
  const hits = await trapped();
  if (hits.length) {
    bad += hits.length;
    console.log(`  ❌ ${name}`);
    hits.forEach(h => console.log(`       ${h.clientH}px 상자에 ${h.scrollH}px 내용 (overflow-y: ${h.overflowY})  .${h.cls}`));
  } else {
    console.log(`  ✓ ${name}`);
  }
}

await b.close();
if (bad) { console.log('\n→ 넘치는 상자에 overflow-y-auto 를 주거나, 부모에 높이가 잡혀 있는지 확인할 것.'); process.exit(1); }
console.log('\n✅ 스크롤 갇힌 화면 없음');
