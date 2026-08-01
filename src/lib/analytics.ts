import { supabase } from '@/integrations/supabase/client';

/**
 * 행동 로그.
 *
 * 설계 원칙:
 *   1) 절대 앱을 느리게 하거나 멈추지 않는다. 로그가 실패해도 유저는 몰라야 한다.
 *      → await 하지 않고, 에러는 삼킨다. 로그 때문에 대여 신청이 막히면 본말전도다.
 *   2) 게스트도 찍는다. 전환 퍼널("둘러보다가 가입")의 시작점이 게스트다.
 *   3) 개인정보를 props에 넣지 않는다. 무엇을 눌렀나지, 무슨 내용을 썼나가 아니다.
 *      (검색어는 예외 — 공급 부족을 알아내려면 "무엇을 찾았나"가 핵심이다)
 */

const ANON_KEY = 'moa_anon_id';
const SESSION_KEY = 'moa_session_id';

/** 가입 전 게스트를 한 사람으로 잇는 익명 id. 브라우저에 영구 저장. */
const getAnonId = (): string => {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
};

/** 이번에 앱을 연 것을 하나로 묶는 세션 id. 탭을 닫으면 사라진다. */
const getSessionId = (): string => {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
};

/** 이벤트 이름 — 오타로 인한 분산을 막으려고 여기서만 정의한다. */
export type EventName =
  // 세션·전환
  | 'session_start' // 앱 진입 (게스트 포함)
  | 'guest_gate_shown' // 게스트 제한 안내가 떴다
  | 'signup_started' // 가입 폼 진입
  | 'signup_completed' // 가입 성공(=프로필 생성)
  | 'login_completed'
  // 온보딩
  | 'onboarding_step' // props: { step: 'intro'|'borrow'|... }
  | 'onboarding_completed'
  | 'onboarding_skipped' // props: { step }
  // 탐색
  | 'tab_viewed' // props: { tab }
  | 'book_viewed' // props: { book_id, from }
  | 'search_performed' // props: { query, result_count }
  | 'search_no_result' // props: { query } — 공급 부족 신호
  | 'filter_applied' // props: { filter, value }
  // 거래 퍼널
  | 'request_started' // 대여/나눔/구매 신청 버튼
  | 'borrow_gate_shown' // 대여/나눔 신청했으나 등록 책 0 → "책 1권 등록" 게이트 표시. props: { book_id, mode }
  | 'request_sent' // props: { book_id, mode }
  | 'request_accepted' // props: { book_id }
  | 'return_completed' // props: { book_id }
  // 공급
  | 'book_upload_started'
  | 'book_upload_completed' // props: { mode, has_photo }
  | 'wishlist_added' // props: { title }
  // 관여
  | 'notification_opened' // props: { type }
  | 'chat_opened'
  | 'push_enabled';

/**
 * 이벤트를 남긴다. fire-and-forget — 호출한 쪽은 기다리지 않는다.
 * @param event 이벤트 이름
 * @param props 부가정보 (개인정보 금지, 검색어는 예외)
 */
export const track = (event: EventName, props: Record<string, unknown> = {}): void => {
  // 로그 하나가 실패해도 앱은 아무 영향 없어야 한다. 그래서 통째로 try로 감싸고 삼킨다.
  try {
    const anon_id = getAnonId();
    const session_id = getSessionId();

    // getUser()를 매번 부르면 느리다. 현재 세션 캐시에서 즉시 읽는다.
    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id ?? null;
      void supabase
        .from('events')
        .insert({ user_id: userId, anon_id, session_id, event, props: props as never })
        .then(() => {}, () => {}); // 성공/실패 모두 무시 — 로그는 조용해야 한다
    }, () => {});
  } catch {
    // 로그가 앱을 멈추게 두지 않는다
  }
};

/** 앱을 열 때 한 번. 세션의 시작점을 찍는다. */
export const trackSessionStart = (): void => {
  // 새로고침마다 중복으로 찍히지 않게, 이 세션에서 이미 찍었으면 건너뛴다.
  try {
    if (sessionStorage.getItem('moa_session_started')) return;
    sessionStorage.setItem('moa_session_started', '1');
  } catch {
    /* storage 없으면 그냥 찍는다 */
  }
  track('session_start');
};
