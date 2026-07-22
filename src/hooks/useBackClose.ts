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
      poppedByUser = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', handlePop);

    return () => {
      window.removeEventListener('popstate', handlePop);
      // 뒤로가기가 아니라 닫기 버튼으로 닫힌 경우 → 쌓아둔 항목을 직접 걷어낸다.
      // 안 그러면 뒤로가기를 한 번 더 눌러야 실제로 이전 화면으로 간다.
      if (!poppedByUser && window.history.state?.moaOverlay) {
        window.history.back();
      }
    };
  }, [isOpen]);
};
