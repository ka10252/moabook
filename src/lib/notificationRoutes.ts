/**
 * 알림 → 화면 연결표 (단일 진실 공급원)
 *
 * 알림을 눌렀는데 아무 일도 안 일어나면, 유저는 다음부터 알림을 안 누른다.
 * 그래서 모든 알림은 "그래서 뭘 보라는 건데?"에 답하는 화면으로 이어져야 한다.
 *
 * DB의 알림 타입이 여기 없으면 그 알림은 **죽은 링크**다.
 * 새 알림을 추가하면 반드시 여기에도 추가할 것.
 * `npm run check:notifications` 가 빠진 타입을 잡아준다.
 */

export type NotificationDestination =
  | 'chat' // 그 대화방을 연다
  | 'book' // 그 책의 상세를 연다
  | 'transactions' // 거래 현황을 연다
  | 'community'; // 커뮤니티 탭을 연다

export interface NotificationRoute {
  destination: NotificationDestination;
  /** 관리·문서용 한국어 이름 */
  label: string;
  /** notification.data에서 목적지를 찾는 데 필요한 키 */
  requires?: string;
}

export const NOTIFICATION_ROUTES: Record<string, NotificationRoute> = {
  // ── 대화에서 이어지는 것들 → 채팅방
  new_message: { destination: 'chat', label: '채팅 메시지', requires: 'conversation_id' },
  book_request: { destination: 'chat', label: '대여·나눔·구매 요청', requires: 'conversation_id' },
  request_accepted: { destination: 'chat', label: '대여 수락', requires: 'conversation_id' },
  return_requested: { destination: 'chat', label: '반납 요청', requires: 'conversation_id' },
  request_pending: { destination: 'chat', label: '요청 후 무응답', requires: 'conversation_id' },
  // 예전 함수가 남긴 타입. 옛 알림을 눌러도 채팅이 열려야 한다.
  chat: { destination: 'chat', label: '채팅 메시지 (구버전)', requires: 'conversation_id' },

  // ── 특정 책으로 이어지는 것들 → 책 상세
  wishlist_match: { destination: 'book', label: '위시리스트 매칭', requires: 'book_id' },
  community_new_book: { destination: 'book', label: '커뮤니티 새 책', requires: 'book_id' },
  waitlist_available: { destination: 'book', label: '대기하던 책 반납됨', requires: 'book_id' },
  waitlist_reminder: { destination: 'book', label: '대기 책 알림', requires: 'book_id' },
  waitlist_join: { destination: 'book', label: '내 책에 대기자 추가', requires: 'book_id' },

  // ── 거래 현황
  return_due: { destination: 'transactions', label: '반납 임박' },
  return_overdue: { destination: 'transactions', label: '반납 연체' },

  // ── 커뮤니티
  community_join: { destination: 'community', label: '커뮤니티 새 멤버', requires: 'community_id' },
};

export const routeFor = (type: string): NotificationRoute | undefined =>
  NOTIFICATION_ROUTES[type];
