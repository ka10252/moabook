/**
 * 팝업이 떠 있는 동안 뒤 화면이 스크롤되지 않는지 확인한다.
 * 백드롭 위에서 휠·터치를 굴려 보고 문서 스크롤 위치가 그대로인지 본다.
 */
import { chromium } from 'playwright-core';

const CHROME = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const BASE = process.env.MOA_URL || 'http://localhost:8081';
const EMAIL = process.env.MOA_EMAIL, PW = process.env.MOA_PW;

const fail = [];
const ok = [];

const b = await chromium.launch({ executablePath: CHROME });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
p.on('pageerror', e => fail.push(`런타임 에러 — ${e.message.split('\n')[0]}`));

if (!EMAIL || !PW) {
  console.log('ℹ️  MOA_EMAIL / MOA_PW 가 없어 건너뛴다.');
  await b.close();
  process.exit(0);
}

await p.goto(`${BASE}/auth`, { waitUntil: 'networkidle' });
await p.locator('input[type="email"]').first().fill(EMAIL);
await p.locator('input[type="password"]').first().fill(PW);
await p.locator('form button[type="submit"]').first().click();
await p.waitForTimeout(4500);
await p.goto(BASE, { waitUntil: 'networkidle' });
await p.waitForTimeout(2600);
await p.getByRole('button', { name: /알겠어요/ }).first().click().catch(() => {});
await p.waitForTimeout(800);

const scrollY = () => p.evaluate(() => window.scrollY || document.documentElement.scrollTop || 0);

/** 팝업을 열고 → 뒤 화면이 안 밀리는지 → 닫고 위치가 돌아오는지 */
async function check(name, open, close) {
  // 앞 항목이 화면을 바꿔놨을 수 있으니 매번 책장으로 돌아가서 시작한다
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(200);
  await p.evaluate(() => window.scrollTo(0, 400));
  await p.waitForTimeout(400);
  const before = await scrollY();
  if (before < 50) { ok.push(`${name} — 건너뜀(스크롤할 내용이 없음)`); return; }

  try { await open(); } catch (e) {
    const why = await p.evaluate(() => {
      const ov = [...document.querySelectorAll('.fixed.inset-0')].map(d => d.className.toString().slice(0, 50));
      return { overlays: ov, body: getComputedStyle(document.body).position };
    });
    fail.push(`${name} — 팝업을 열지 못함: ${e.message.split('\n')[0]} | 남은 오버레이 ${JSON.stringify(why)}`);
    return;
  }
  await p.waitForTimeout(700);

  const state = await p.evaluate(() => {
    const ov = document.querySelectorAll('.fixed.inset-0:not([data-no-scroll-lock])');
    // 뒤 화면이 실제로 움직였는지는 배경 요소의 화면상 위치로 본다.
    // body 를 fixed 로 만들면 scrollY 값 자체는 브라우저마다 다르게 남는다.
    const anchor = document.querySelector('main, [data-bookcase], header');
    // 잠금 주체는 둘이다 — 우리 hook(body fixed) 또는 Radix(data-scroll-locked)
    const locked = getComputedStyle(document.body).position === 'fixed'
      || document.body.hasAttribute('data-scroll-locked');
    return { overlays: ov.length, locked,
             anchorTop: anchor ? Math.round(anchor.getBoundingClientRect().top) : null };
  });
  if (state.overlays === 0) { fail.push(`${name} — 팝업이 안 열림(오버레이 0개)`); return; }

  await p.mouse.move(195, 300);
  await p.mouse.wheel(0, 600);
  await p.waitForTimeout(350);
  await p.touchscreen.tap(195, 700).catch(() => {});
  await p.waitForTimeout(200);

  const after = await p.evaluate(() => {
    const anchor = document.querySelector('main, [data-bookcase], header');
    return anchor ? Math.round(anchor.getBoundingClientRect().top) : null;
  });

  if (!state.locked) fail.push(`${name} — 오버레이 ${state.overlays}개가 떠 있는데 body 가 안 잠김`);
  else if (state.anchorTop !== null && after !== state.anchorTop)
    fail.push(`${name} — 잠긴 상태인데 뒤 화면이 ${state.anchorTop}→${after} 로 밀림`);
  else ok.push(`${name} — 잠김 확인`);

  try { await close(); } catch { /* 닫기 실패해도 다음 항목을 본다 */ }
  await p.waitForTimeout(900);
  const restored = await scrollY();
  const stillLocked = await p.evaluate(() => getComputedStyle(document.body).position === 'fixed'
    || document.body.hasAttribute('data-scroll-locked'));
  if (stillLocked) fail.push(`${name} — 닫았는데 body 가 잠긴 채 남음`);
  else if (Math.abs(restored - before) > 4) fail.push(`${name} — 닫은 뒤 스크롤 위치가 ${before}→${restored} 로 튐`);
  else ok.push(`${name} — 닫은 뒤 복원`);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(200);
}

const esc = async () => { await p.keyboard.press('Escape'); };

await check('책 상세',
  async () => { await p.locator('[data-onboarding="view-toggle"]').scrollIntoViewIfNeeded().catch(() => {});
                await p.locator('button').filter({ has: p.locator('.spine-title, [data-spine]') }).first()
                  .click({ force: true, timeout: 4000 })
                  .catch(async () => { await p.mouse.click(120, 500); }); },
  async () => { await esc(); await p.mouse.click(195, 15); });

await check('알림함',
  async () => { await p.locator('header button').nth(1).click(); },
  esc);

await check('상세 필터',
  async () => { await p.locator('button[aria-label="상세 필터"]').click(); },
  esc);

await check('거래 현황',
  async () => { await p.locator('button[title="거래 현황"]').click(); },
  // Escape 를 안 받는 팝업이라 닫기 버튼을 직접 누른다
  async () => { await p.locator('.fixed.inset-0 button').filter({ hasNot: p.locator('span') }).first().click({ timeout: 4000 }); });

await b.close();

for (const m of ok) console.log('  ✓', m);
if (fail.length) {
  console.log('');
  for (const m of fail) console.log('  ✗', m);
  console.log(`\n❌ 스크롤 잠금 ${fail.length}건 실패`);
  process.exit(1);
}
console.log('\n✅ 스크롤 잠금 통과 — 팝업 뒤 화면이 밀리지 않는다');
