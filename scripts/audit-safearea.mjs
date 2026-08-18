/**
 * 안전영역 감사 — 노치·홈 인디케이터에 가려 **못 누르는 버튼**을 찾는다.
 *
 * 헤드리스 브라우저에서 `env(safe-area-inset-*)` 는 항상 0이라 그냥은 검증이 안 된다.
 * 그래서 앱이 env() 를 `--safe-top` / `--safe-bottom` 변수로 감싸 쓰고,
 * 여기서 그 변수를 실제 기종 값으로 덮어써 노치를 흉내 낸다.
 *
 * ⚠️ 스크롤로 빼낼 수 있는 요소는 문제로 세지 않는다. 긴 목록의 중간 항목이
 *    잠깐 그 자리에 있는 것과, 고정 버튼이 영영 가리는 것은 다르다.
 *
 *   npm run audit:safearea
 *   MOA_EMAIL=... MOA_PW=... npm run audit:safearea http://localhost:8080
 */
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || process.env.MOA_URL || 'http://localhost:8080';
const EMAIL = process.env.MOA_EMAIL;
const PW = process.env.MOA_PW;
const CHROME =
  process.env.PLAYWRIGHT_CHROME ||
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

// iPhone 17 기준. 노치 기종 중 상단 여백이 큰 축이라 이걸로 맞추면 대부분 커버된다.
const SAFE_TOP = 59;
const SAFE_BOTTOM = 34;

const problems = [];

async function run() {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });

  // 노치를 흉내 낸다. 앱이 --safe-* 변수를 쓰므로 이 한 줄로 전 화면에 반영된다.
  await page.addInitScript(([t, b]) => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.setProperty('--safe-top', `${t}px`);
      document.documentElement.style.setProperty('--safe-bottom', `${b}px`);
    });
  }, [SAFE_TOP, SAFE_BOTTOM]);

  const check = async (name) => {
    const found = await page.evaluate(([top, bottom]) => {
      const out = [];
      for (const el of document.querySelectorAll('button, a[href], [role="button"], input, select')) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        // 화면 밖은 제외 (스크롤로 내려가 있는 것)
        if (r.bottom < 0 || r.top > innerHeight) continue;
        const label = (el.innerText || el.getAttribute('aria-label') || el.tagName).replace(/\n/g, ' ').trim().slice(0, 22);

        // ⚠️ 안전영역 안에 있다고 다 문제는 아니다. **스크롤해서 빼낼 수 있으면 괜찮다** —
        //    긴 목록의 중간 항목이 잠깐 그 자리에 있는 것뿐이다.
        //    진짜 문제는 (a) 고정된 요소이거나 (b) 스크롤로도 못 빼내는 경우다.
        const pos = getComputedStyle(el).position;
        const pinned = pos === 'fixed' || pos === 'sticky';
        let scrollable = false;
        for (let n = el.parentElement; n && !scrollable; n = n.parentElement) {
          const ov = getComputedStyle(n).overflowY;
          if ((ov === 'auto' || ov === 'scroll') && n.scrollHeight > n.clientHeight + 4) scrollable = true;
        }
        if (document.documentElement.scrollHeight > innerHeight + 4) scrollable = true;
        if (!pinned && scrollable) continue;

        // 요소의 '중심'이 가려지면 사실상 못 누른다
        const cy = r.top + r.height / 2;
        if (cy < top) out.push({ label, y: Math.round(r.top), where: '상단', pos });
        else if (cy > innerHeight - bottom) out.push({ label, y: Math.round(r.top), where: '하단', pos });
      }
      return out;
    }, [SAFE_TOP, SAFE_BOTTOM]);
    for (const f of found) problems.push({ screen: name, ...f });
    console.log(`  ${found.length === 0 ? '✅' : '❌'} ${name.padEnd(20)} ${found.length ? JSON.stringify(found) : ''}`);
  };

  const go = async (name, path, wait = 1500) => {
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(wait);
    await page.getByRole('button', { name: /알겠어요/ }).first().click().catch(() => {});
    await page.waitForTimeout(500);
    await check(name);
  };

  await go('서가', '/?tab=shelf');
  await go('위시리스트', '/?tab=wishlist');
  await go('커뮤니티', '/?tab=community');
  await go('프로필', '/?tab=profile');
  await go('등록', '/?tab=upload');
  await go('로그인', '/auth', 1600);
  await go('약관', '/terms', 1400);
  await go('개인정보', '/privacy', 1400);

  if (EMAIL && PW) {
    await page.goto(BASE + '/auth', { waitUntil: 'networkidle' });
    await page.locator('input[type="email"]').first().fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PW);
    await page.getByRole('button', { name: /로그인/ }).first().click();
    await page.waitForTimeout(3500);
    await go('서가(로그인)', '/?tab=shelf');
    await go('채팅', '/?chat=1', 3000);
    await go('프로필(로그인)', '/?tab=profile');
  } else {
    console.log('\nℹ️  MOA_EMAIL / MOA_PW 가 없어 비로그인 화면만 확인했다.');
  }

  await browser.close();

  if (problems.length === 0) {
    console.log(`\n✅ 안전영역 통과 — 상단 ${SAFE_TOP}px · 하단 ${SAFE_BOTTOM}px 가정에서 가려지는 버튼 없음`);
    process.exit(0);
  }
  console.log(`\n❌ 가려지는 버튼 ${problems.length}개`);
  for (const p of problems) console.log(`  ${p.screen} · ${p.where} · "${p.label}" (y=${p.y})`);
  process.exit(1);
}

run().catch((e) => { console.error('감사 실행 실패:', e.message); process.exit(1); });
