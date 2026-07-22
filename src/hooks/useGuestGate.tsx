import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './useAuth';

/**
 * 게스트(비로그인) 유저도 앱을 둘러볼 수 있다. 로그인 벽을 먼저 세우면
 * 무엇을 위한 서비스인지 보기도 전에 이탈하기 때문이다.
 *
 * 대신 두 가지 지점에서 가입을 유도한다:
 *  1) 둘러보기를 3번 하면 → 가입 권유 팝업. 단 한 번뿐이다.
 *     닫은 사람에게 계속 들이미는 건 권유가 아니라 방해다.
 *  2) 쓰기 동작(대여 신청·책 등록·좋아요·프로필)을 시도하면 → 그때만 가입 요구.
 *     이건 계정이 없으면 물리적으로 불가능한 동작이라 안 띄울 수가 없다.
 */
const BROWSE_LIMIT = 3;

/**
 * browse — 둘러보다 3번째에 뜨는 권유 (닫으면 끝)
 * action — 대여 신청·좋아요처럼 계정이 있어야 하는 '행동'
 * page   — 등록·프로필처럼 계정이 없으면 화면 자체를 열 수 없는 '페이지'
 */
export type PromptReason = 'browse' | 'action' | 'page';

interface GuestGateValue {
  isGuest: boolean;
  showAuthPrompt: boolean;
  /** 팝업 문구를 상황에 맞게 바꾸기 위한 사유 */
  promptReason: PromptReason;
  closeAuthPrompt: () => void;
  /** 둘러보기 행동 1회 기록. 한도를 넘으면 팝업을 띄운다. */
  trackBrowse: () => void;
  /**
   * 로그인이 필요한 동작/화면을 감싼다.
   * @returns 진행해도 되면 true, 게스트라 막혔으면 false
   */
  requireAuth: (reason?: 'action' | 'page') => boolean;
}

const GuestGateContext = createContext<GuestGateValue | undefined>(undefined);

export const GuestGateProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const isGuest = !user;

  const [browseCount, setBrowseCount] = useState(0);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [promptReason, setPromptReason] = useState<PromptReason>('browse');
  /** 권유 팝업을 한 번 닫은 사람에게는 다시 띄우지 않는다 */
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('moa_guest_prompt_dismissed') === '1'
  );

  const trackBrowse = useCallback(() => {
    if (!isGuest || dismissed) return;
    setBrowseCount((prev) => {
      const next = prev + 1;
      if (next >= BROWSE_LIMIT) {
        setPromptReason('browse');
        setShowAuthPrompt(true);
      }
      return next;
    });
  }, [isGuest, dismissed]);

  const requireAuth = useCallback(
    (reason: 'action' | 'page' = 'action') => {
      if (!isGuest) return true;
      // 계정 없이는 불가능한 지점이다. 여긴 dismissed와 무관하게 알려야 한다.
      setPromptReason(reason);
      setShowAuthPrompt(true);
      return false;
    },
    [isGuest]
  );

  const closeAuthPrompt = useCallback(() => {
    setShowAuthPrompt(false);
    // 한 번 봤으면 둘러보기 권유는 끝. 이후엔 스스로 가입 버튼을 찾게 둔다.
    setDismissed(true);
    sessionStorage.setItem('moa_guest_prompt_dismissed', '1');
  }, []);

  return (
    <GuestGateContext.Provider
      value={{ isGuest, showAuthPrompt, promptReason, closeAuthPrompt, trackBrowse, requireAuth }}
    >
      {children}
    </GuestGateContext.Provider>
  );
};

export const useGuestGate = () => {
  const ctx = useContext(GuestGateContext);
  if (!ctx) throw new Error('useGuestGate must be used within GuestGateProvider');
  return ctx;
};
