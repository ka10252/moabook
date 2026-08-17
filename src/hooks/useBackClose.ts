import { useEffect, useRef } from 'react';

/**
 * 열려 있는 오버레이(모달·시트·팝업)를 뒤로가기로 닫는다.
 *
 * 모달을 React state로만 열면 브라우저 히스토리에는 아무 흔적이 남지 않는다.
 * 그래서 모달이 떠 있는 상태로 뒤로가기를 누르면 모달은 그대로 있고 뒤의 페이지만 이동해버린다.
 * (안드로이드 하드웨어 뒤로가기에서는 특히 치명적이다 — 유저는 "닫기"를 기대한다.)
 *
 * 해결: 열릴 때 히스토리 항목을 하나 쌓아두고, popstate가 오면 그 항목을 소비하며 닫는다.
 * 닫기 버튼으로 닫힌 경우에는 쌓아둔 항목을 되돌려 히스토리를 원래대로 맞춘다.
 */
/**
 * 우리가 정리 과정에서 부른 history.back()이 만든 popstate 한 번을 무시하기 위한 표식.
 *
 * 왜 모듈 스코프인가 — 정리 함수는 리스너를 뗀 뒤 back()을 부른다. 그 popstate가 도착할 땐
 * 이미 다른(혹은 다시 마운트된) 인스턴스의 리스너가 붙어 있어서, 그쪽이 "유저가 뒤로가기를
 * 눌렀다"고 착각하고 방금 열린 오버레이를 닫아버린다.
 *
 * 실제로 그랬다: React StrictMode는 개발 모드에서 effect를 두 번 실행한다.
 *   mount → push → (정리) back() → 다시 mount → push → 늦게 도착한 popstate → 즉시 닫힘.
 * 반납 리뷰 팝업이 뜨자마자 사라지고 "다시 묻지 않기"까지 걸린 원인이 이거였다.
 */
let ignoreNextPop = false;

export const useBackClose = (isOpen: boolean, onClose: () => void) => {
  // onClose가 매 렌더 새 함수여도 effect가 재실행되지 않도록 ref에 담아둔다
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    // 이 항목이 곧 "모달이 열려 있다"는 히스토리상의 표식이다
    window.history.pushState({ moaOverlay: true }, '');
    let poppedByUser = false;

    const handlePop = () => {
      if (ignoreNextPop) {
        // 우리가 걷어내려고 부른 back()이다. 유저의 뒤로가기가 아니다.
        ignoreNextPop = false;
        return;
      }
      poppedByUser = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', handlePop);

    return () => {
      window.removeEventListener('popstate', handlePop);
      // 뒤로가기가 아니라 닫기 버튼으로 닫힌 경우 → 쌓아둔 항목을 직접 걷어낸다.
      // 안 그러면 뒤로가기를 한 번 더 눌러야 실제로 이전 화면으로 간다.
      if (!poppedByUser && window.history.state?.moaOverlay) {
        ignoreNextPop = true;
        window.history.back();
        // 어떤 이유로든 popstate가 안 오면 표식이 남아 다음 진짜 뒤로가기를 삼킨다.
        // back()의 popstate는 다음 틱에 오므로 그보다 넉넉히 두고 되돌린다.
        setTimeout(() => { ignoreNextPop = false; }, 400);
      }
    };
  }, [isOpen]);
};
