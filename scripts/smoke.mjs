/**
 * 스모크 QA — 로그인해서 주요 화면을 한 바퀴 돌며 런타임 에러를 잡는다.
 *
 * 왜 필요한가: `tsc --noEmit`과 `vite build`는 이런 걸 못 잡는다.
 *   · props 인터페이스에는 추가했는데 구조 분해에서 빠뜨림 → "X is not defined"
 *   · lucide의 Map을 그냥 import → 전역 Map 생성자를 가려 "Map is not a constructor"
 *   · DB에 없는 컬럼을 select → 400
 *   · 공용 뷰를 DROP/CREATE 하며 남의 컬럼을 빠뜨림 → 그 화면만 통째로 죽음 (42703)
 * 셋 다 실제로 이 프로젝트에서 화면을 통째로 죽였고, 빌드는 전부 통과했다.
 * 기능을 붙였으면 커밋 전에 이걸 돌린다.
 *
 * 짝꿍: `npm run audit:safearea` — 노치·홈 인디케이터에 가려 못 누르는 버튼을 찾는다.
 * 새 화면이나 전체화면 오버레이를 만들면 **두 스크립트 모두에** 그 진입을 추가한다.
 *
 * ⚠️ 타입체크는 반드시 `npm run typecheck`(= tsc -p tsconfig.app.json)로 돌린다.
 *    루트의 `npx tsc --noEmit`은 tsconfig.json이 `"files": []` + 프로젝트 참조라
 *    **아무 파일도 검사하지 않고 조용히 통과한다.** 실제로 그걸 믿고 넘긴 적이 있다.
 *    2026-08-19에 supabase 타입을 재생성해 **에러 0개**로 만들었다. 하나라도 늘면 그건 새 오류다.
 *    마이그레이션을 추가하면 타입도 같이 재생성한다:
 *      supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts
 *
 * 사용법:
 *   npm run dev                      # 다른 터미널에서
 *   MOA_EMAIL=... MOA_PW=... node scripts/smoke.mjs [http://localhost:8081]
 *
 * 로그인 정보가 없으면 비로그인으로 갈 수 있는 화면만 돈다.
 */
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || process.env.MOA_URL || 'http://localhost:8080';
const EMAIL = process.env.MOA_EMAIL;
const PW = process.env.MOA_PW;

// 설치된 Chrome for Testing을 찾는다. 없으면 PLAYWRIGHT_CHROME으로 직접 지정.
const CHROME =
  process.env.PLAYWRIGHT_CHROME ||
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

/** 무시해도 되는 잡음 — 실제 버그가 아닌 것만 최소한으로 */
const IGNORE = [
  /React Router Future Flag/i,
  /Download the React DevTools/i,
  /WebSocket connection to .*realtime/i,
  /favicon/i,
];

const problems = [];
const note = (screen, kind, msg) => problems.push({ screen, kind, msg });

async function run() {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

  let screen = 'boot';
  page.on('pageerror', (e) => note(screen, 'JS 예외', e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (IGNORE.some((re) => re.test(t))) return;
    note(screen, '콘솔 에러', t.slice(0, 200));
  });
  page.on('response', async (r) => {
    if (r.status() < 400) return;
    if (!r.url().includes('supabase')) return;
    let body = '';
    try { body = (await r.text()).slice(0, 160); } catch { /* ignore */ }
    note(screen, `HTTP ${r.status()}`, `${r.url().split('/rest/v1/')[1]?.slice(0, 60) ?? r.url().slice(-60)} :: ${body}`);
  });

  const go = async (name, path, wait = 2500) => {
    screen = name;
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch((e) => note(name, '이동 실패', e.message));
    await page.waitForTimeout(wait);
    const text = await page.locator('body').innerText().catch(() => '');
    if (/화면을 불러오지 못했|잠시 후 다시 시도/.test(text)) note(name, '오류 화면', '에러 바운더리가 떴다');
    return text;
  };

  /**
   * optional=true 는 "계정 상태에 따라 없을 수도 있는" 버튼에 쓴다.
   * (예: 커뮤니티에 가입 안 한 계정, 반납 완료 카드가 없는 대화방)
   * 없는 걸 실패로 세면 매번 빨간불이 떠서 진짜 실패를 못 알아본다.
   */
  const click = async (name, locator, wait = 2000, optional = false) => {
    screen = name;
    const el = page.locator(locator).first();
    if ((await el.count()) === 0) {
      if (!optional) note(name, '요소 없음', locator);
      else console.log(`  · 건너뜀 — ${name} (이 계정엔 없음)`);
      return false;
    }
    await el.click({ force: true }).catch((e) => note(name, '클릭 실패', e.message));
    await page.waitForTimeout(wait);
    const text = await page.locator('body').innerText().catch(() => '');
    if (/화면을 불러오지 못했|잠시 후 다시 시도/.test(text)) note(name, '오류 화면', '에러 바운더리가 떴다');
    return true;
  };

  // ── 비로그인으로 갈 수 있는 화면
  await go('홈(서가)', '/');
  await click('서가·표지뷰', 'button[aria-label="표지로 보기"]');
  await click('서가·지도뷰', 'button[aria-label="지도로 보기"]', 3500);
  await click('서가·책등뷰', 'button[aria-label="책등으로 보기"]');
  await click('필터 시트', 'button[aria-label="상세 필터"]');
  await page.keyboard.press('Escape').catch(() => {});
  await go('위시리스트', '/?tab=wishlist');
  await go('커뮤니티', '/?tab=community');
  await go('프로필', '/?tab=profile');
  await go('가상공간', '/space', 4000);
  await go('약관', '/terms', 1200);
  await go('개인정보', '/privacy', 1200);
  await go('로그인', '/auth', 1500);

  // ── 로그인이 필요한 화면
  if (EMAIL && PW) {
    screen = '로그인';
    await page.locator('input[type="email"]').first().fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PW);
    await page.getByRole('button', { name: /로그인/ }).first().click();
    await page.waitForTimeout(4500);
    if (page.url().includes('/auth')) note('로그인', '실패', '로그인 후에도 /auth에 머무름');

    // 화면을 '열기'만 하면 부족하다. 실제로 죽은 것들은 전부 한 번 더 눌러야
    // 드러났다(남의 프로필, 반납 카드 버튼). 눌러서 들어가는 데까지 간다.
    await go('홈(로그인)', '/');
    // ⚠️ 책 제목을 고정으로 쓰지 않는다. 예전엔 '자유론|데미안|불안' 을 찾았는데,
    //    그 책이 서가에서 사라지자 조용히 실패하면서 뒤따르는 '책 주인 프로필' 검사까지
    //    무의미해졌다. 지금 화면에 실제로 있는 첫 책을 연다.
    screen = '책 상세';
    await page.locator('button[aria-label="표지로 보기"]').first().click().catch(() => {});
    await page.waitForTimeout(1500);
    const opened = await page.evaluate(() => {
      const img = document.querySelector('main img[alt]');
      const btn = img?.closest('button') || img?.parentElement;
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (!opened) note('책 상세', '요소 없음', '서가에 열 수 있는 책이 없다');
    await page.waitForTimeout(2500);

    // 남의 프로필 — profiles_public 뷰에서 컬럼이 빠져 통째로 죽은 적이 있다.
    // 토스트가 아니라 화면 안 문구로 확인해야 한다. 에러는 콘솔로만 나가고
    // 화면에는 "프로필을 찾을 수 없습니다"만 남는다.
    screen = '책 주인 프로필';
    const openedOwner = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (el) => el.className.includes('border-t') && /프로필/.test(el.innerText),
      );
      if (!b) return false;
      b.click();
      return true;
    });
    if (!openedOwner) note('책 주인 프로필', '요소 없음', '책 상세에서 주인 줄을 못 찾음');
    else {
      await page.waitForTimeout(3000);
      const t = await page.locator('body').innerText().catch(() => '');
      if (/프로필을 찾을 수 없습니다/.test(t)) note('책 주인 프로필', '빈 화면', '프로필을 불러오지 못했다');
      await page.keyboard.press('Escape').catch(() => {});
    }
    await page.keyboard.press('Escape').catch(() => {});

    await go('채팅 목록', '/?chat=1', 3000);
    await click('대화방', 'div[data-ptr-ignore] button.w-full', 3500);
    // 반납 완료 카드의 버튼들 — 여기가 리뷰·매너평가 진입점이다
    await click('리뷰 남기기', 'button:has-text("리뷰 남기기")', 2500, true);
    await page.keyboard.press('Escape').catch(() => {});
    await click('거래 상대 평가', 'button:has-text("거래 상대 평가하기")', 2500, true);
    await page.keyboard.press('Escape').catch(() => {});

    await go('위시리스트(로그인)', '/?tab=wishlist');
    await click('위시 추가 폼', 'button:has-text("책 추가")');
    await page.keyboard.press('Escape').catch(() => {});
    await go('커뮤니티(로그인)', '/?tab=community', 3000);
    // 커뮤니티 상세 → 그 안에서 책장까지(F15). 팝업 안 화면 전환이라 열기만 해선 안 잡힌다.
    await click('커뮤니티 상세', 'text=/^멤버 \\d+명$/', 3000, true);
    if (await click('커뮤니티 책장', 'button:has-text("책장")', 3000, true)) {
      const t = await page.locator('body').innerText().catch(() => '');
      if (!/책장 \(\d+\)|아직 등록된 책이 없습니다/.test(t)) {
        note('커뮤니티 책장', '안 열림', '팝업 안에 책장이 안 떴다');
      }
      if (page.url().includes('tab=shelf')) {
        note('커뮤니티 책장', '메인으로 튕김', '팝업 안에서 열려야 한다(F15)');
      }
    }
    await page.keyboard.press('Escape').catch(() => {});

    // 배지 상세(F17) — 프로필에서 배지를 눌러 조건이 뜨는지
    await go('프로필 배지', '/?tab=profile', 3000);
    await click('활동 배지 펼치기', 'text=활동 배지', 1500, true);
    if (await click('배지 상세', 'svg[role="img"]', 1800, true)) {
      const t = await page.locator('body').innerText().catch(() => '');
      if (!/달성|단계 ·|등록|가입|반납|나눔/.test(t)) note('배지 상세', '내용 없음', '조건 문구가 안 보인다');
      await page.keyboard.press('Escape').catch(() => {});
    }
    await go('프로필(로그인)', '/?tab=profile', 3000);
    await click('책 등록 폼', 'nav button:has-text("등록")', 2500);
  } else {
    console.log('ℹ️  MOA_EMAIL / MOA_PW 가 없어 비로그인 화면만 확인했다.\n');
  }

  await browser.close();

  // ── 결과
  const byScreen = new Map();
  for (const p of problems) {
    const key = `${p.screen} · ${p.kind}`;
    if (!byScreen.has(key)) byScreen.set(key, new Set());
    byScreen.get(key).add(p.msg);
  }

  if (byScreen.size === 0) {
    console.log('✅ 스모크 통과 — 확인한 화면에서 런타임 에러 없음');
    process.exit(0);
  }

  console.log('❌ 문제 발견\n');
  for (const [key, msgs] of byScreen) {
    console.log(`  ${key}`);
    for (const m of msgs) console.log(`    - ${m}`);
  }
  process.exit(1);
}

run().catch((e) => { console.error('스모크 실행 실패:', e.message); process.exit(1); });
