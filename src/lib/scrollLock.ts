/**
 * 배경 스크롤 잠금.
 *
 * 팝업은 `fixed inset-0` 백드롭으로 화면을 덮지만, 그것만으로는 뒤가 안 움직이지
 * 않는다. 백드롭 자체가 스크롤되지 않는 요소라 터치/휠 제스처가 문서로 그대로
 * 흘러가 뒤 화면이 밀린다(스크롤 체이닝). 그래서 문서를 직접 묶는다.
 *
 * `overflow: hidden` 대신 `position: fixed` 를 쓰는 이유:
 *  - iOS 사파리·WKWebView 는 body 의 overflow:hidden 을 무시하고 고무줄 스크롤을 허용한다.
 *  - overflow 는 Radix(react-remove-scroll)도 건드리는 속성이라, 우리가 같이 만지면
 *    복원 순서가 꼬여 body 가 잠긴 채 남을 수 있다. position/top 만 쓰면 충돌하지 않는다.
 *
 * body 를 fixed 로 만들면 문서가 최상단으로 튀므로, 잠글 때 스크롤 위치를 top 에
 * 음수로 옮겨 담았다가 풀 때 되돌린다.
 */

let depth = 0;
let savedY = 0;
let saved: { position: string; top: string; left: string; right: string; width: string } | null = null;

export function lockScroll(): void {
  if (depth++ > 0) return; // 팝업 위에 팝업이 떠도 잠금은 한 번만
  const style = document.body.style;
  savedY = window.scrollY || document.documentElement.scrollTop || 0;
  saved = {
    position: style.position,
    top: style.top,
    left: style.left,
    right: style.right,
    width: style.width,
  };
  style.position = 'fixed';
  style.top = `-${savedY}px`;
  style.left = '0';
  style.right = '0';
  style.width = '100%';
}

export function unlockScroll(): void {
  if (depth === 0) return;
  if (--depth > 0) return; // 아직 남은 팝업이 있다
  const style = document.body.style;
  if (saved) {
    style.position = saved.position;
    style.top = saved.top;
    style.left = saved.left;
    style.right = saved.right;
    style.width = saved.width;
    saved = null;
  }
  // 'instant' 여야 한다. 부드럽게 굴리면 팝업이 닫히는 동안 화면이 흐른다.
  window.scrollTo({ top: savedY, left: 0, behavior: 'instant' as ScrollBehavior });
}

/** 테스트/디버깅용 — 현재 잠금 깊이 */
export function scrollLockDepth(): number {
  return depth;
}
