-- DB가 실제로 "살아있는지" 검사한다.
--
-- 왜 필요한가:
--   함수가 존재한다 ≠ 그 함수가 호출된다.
--   실제로 notify_on_new_message() 함수는 있는데 트리거가 안 붙어 있어서,
--   대여 요청 알림이 두 달 동안 단 한 건도 나가지 않았다. 아무도 몰랐다.
--   기능이 조용히 죽으면 유저가 대신 발견해준다. 그 전에 우리가 발견해야 한다.
--
-- 쓰는 법:  npm run db:check
-- 모두 통과하면 "ALL OK", 하나라도 빠지면 그 줄에 ❌ 가 뜬다.

WITH expected(kind, name, ok) AS (
  VALUES
    -- 알림을 만드는 트리거들. 이게 없으면 알림이 아예 생성되지 않는다.
    ('트리거', 'trg_notify_new_message (messages → 요청·채팅 알림)',
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_notify_new_message' AND NOT tgisinternal)),
    ('트리거', 'trg_notify_wishlist_match (books → 위시 매칭)',
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_notify_wishlist_match' AND NOT tgisinternal)),
    ('트리거', 'trg_notify_community_new_book (books → 커뮤니티 새 책)',
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_notify_community_new_book' AND NOT tgisinternal)),
    ('트리거', 'trg_notify_waitlist (books → 대기 책 반납)',
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_notify_waitlist' AND NOT tgisinternal)),
    ('트리거', 'on_auth_user_created (가입 → 프로필 생성)',
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='on_auth_user_created' AND NOT tgisinternal)),

    -- 알림 → 잠금화면 푸시. 이게 없으면 인앱 알림만 뜨고 푸시는 안 간다.
    ('트리거', 'trg_notifications_push (notifications → 잠금화면 푸시)',
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_notifications_push' AND NOT tgisinternal)),

    -- 매일 도는 작업. 없으면 반납 임박/연체/무응답 알림이 영원히 안 온다.
    ('예약작업', 'moa-daily-notifications (매일 09:00 SGT)',
      EXISTS(SELECT 1 FROM cron.job WHERE jobname='moa-daily-notifications')),

    -- 푸시 구독 저장. GRANT가 없으면 RLS가 아무리 맞아도 42501로 전부 막힌다.
    ('권한', 'push_subscriptions INSERT to authenticated (구독 저장)',
      EXISTS(SELECT 1 FROM information_schema.role_table_grants
             WHERE table_name='push_subscriptions' AND grantee='authenticated' AND privilege_type='INSERT')),
    -- 이게 없으면 send-push가 구독을 못 읽어서 조용히 "보낼 대상 0명"으로 끝난다. 에러도 안 난다.
    ('권한', 'push_subscriptions SELECT to service_role (푸시 발송)',
      EXISTS(SELECT 1 FROM information_schema.role_table_grants
             WHERE table_name='push_subscriptions' AND grantee='service_role' AND privilege_type='SELECT')),

    -- 대화방 중복 방지. 없으면 대여 요청 한 번에 메시지가 두 개 간다.
    ('제약', 'conversations_participant_pair_key (대화방 중복 방지)',
      EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='conversations_participant_pair_key')),

    -- 나눔 모드
    ('타입', 'book_mode에 give 포함',
      EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
             WHERE t.typname='book_mode' AND e.enumlabel='give')),

    -- 신고·차단 (스토어 심사 요건)
    ('테이블', 'reports / blocked_users (신고·차단)',
      to_regclass('public.reports') IS NOT NULL AND to_regclass('public.blocked_users') IS NOT NULL)
)
SELECT
  CASE WHEN ok THEN '✅' ELSE '❌ 없음' END AS 상태,
  kind AS 종류,
  name AS 항목
FROM expected
ORDER BY ok, kind, name;
