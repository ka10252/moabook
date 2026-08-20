import { useEffect } from 'react';
import { lockScroll, unlockScroll } from '@/lib/scrollLock';

/**
 * 화면을 덮는 레이어가 하나라도 떠 있으면 뒤 화면을 잠근다.
 *
 * 팝업이 30곳 넘게 손으로 만들어져 있어 각 파일에 잠금을 심으면 새로 만드는
 * 팝업마다 빠뜨리게 된다. 대신 이 앱의 모든 팝업 루트가 공통으로 갖는 표식
 * (`fixed inset-0`)을 관찰해서 한 곳에서 처리한다.
 *
 * 예외를 두려면 그 루트에 `data-no-scroll-lock` 을 붙인다. 온보딩처럼 뒤 화면을
 * 스크롤해서 대상을 보여줘야 하는 레이어가 여기 해당한다.
 */
const OVERLAY_SELECTOR = '.fixed.inset-0:not([data-no-scroll-lock])';

/**
 * Radix(다이얼로그·시트)는 열릴 때 body 에 `data-scroll-locked` 를 달고
 * `body[data-scroll-locked] { position: relative !important }` 규칙을 주입한다.
 * !important 라 우리 인라인 스타일을 이긴다 — 겹쳐 걸면 우리 쪽이 무력화될 뿐이다.
 * Radix 가 이미 잠근 상태라면 그대로 두고 손대지 않는다.
 */
const radixLocked = () => document.body.hasAttribute('data-scroll-locked');

export function useOverlayScrollLock(): void {
  useEffect(() => {
    let locked = false;
    let queued = 0;

    const sync = () => {
      queued = 0;
      const open = document.querySelectorAll(OVERLAY_SELECTOR).length > 0 && !radixLocked();
      if (open === locked) return;
      locked = open;
      if (open) lockScroll();
      else unlockScroll();
    };

    // DOM 변화는 채팅 메시지처럼 팝업과 무관한 것도 쏟아진다.
    // 프레임당 한 번으로 묶어 실제 조회는 최소로 한다.
    const schedule = () => {
      if (queued) return;
      queued = requestAnimationFrame(sync);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-no-scroll-lock', 'data-scroll-locked'],
    });
    sync();

    return () => {
      observer.disconnect();
      if (queued) cancelAnimationFrame(queued);
      if (locked) unlockScroll();
    };
  }, []);
}
