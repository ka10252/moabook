-- 알림 4종 추가
--   1) 반납 연체        (D+1, D+3, 이후 매주) — 빌린 사람 + 책 주인 양쪽
--   2) 요청 후 무응답    (24시간 지나도록 책 주인이 답이 없을 때) — 책 주인에게 리마인드
--   3) 위시리스트 매칭   (누가 내가 찾던 책을 올렸을 때)
--   4) 내 커뮤니티 새 책 (내가 속한 커뮤니티에 책이 올라왔을 때)
--
-- notifications 에 행이 생기면 trg_notifications_push 가 잠금화면 푸시까지 보낸다.


-- ─────────────────────────────────────────────────────────────
-- 1. 반납 연체
-- ─────────────────────────────────────────────────────────────
-- 연체는 가장 흔한 분쟁이다. 아무도 안 알려주면 책 주인이 직접 독촉해야 하고,
-- 그 불쾌함 때문에 다시는 안 빌려준다 → 공급이 마른다.
-- 매일 울리면 그것대로 스팸이라, D+1 · D+3 · 그 뒤로는 주 1회만 울린다.

CREATE OR REPLACE FUNCTION public.notify_overdue_returns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t            RECORD;
  days_over    int;
BEGIN
  FOR t IN
    SELECT tx.id, tx.borrower_id, tx.owner_id, tx.end_date,
           b.title AS book_title,
           bp.nickname AS borrower_nickname
    FROM public.transactions tx
    JOIN public.books b   ON b.id = tx.book_id
    LEFT JOIN public.profiles bp ON bp.id = tx.borrower_id
    WHERE tx.status = 'active'
      AND tx.type = 'rent'
      AND tx.end_date IS NOT NULL
      AND tx.end_date::date < CURRENT_DATE
  LOOP
    days_over := CURRENT_DATE - t.end_date::date;

    -- D+1, D+3, 이후 7일 간격으로만. 매일 울리면 알림을 꺼버린다.
    CONTINUE WHEN NOT (days_over IN (1, 3) OR days_over % 7 = 0);

    -- 오늘 이미 보냈으면 건너뛴다 (cron 중복 실행 방지)
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.type = 'return_overdue'
        AND n.data->>'transaction_id' = t.id::text
        AND n.created_at::date = CURRENT_DATE
    );

    -- 빌린 사람 — 재촉이 아니라 상기시키는 톤으로
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      t.borrower_id,
      'return_overdue',
      '반납일이 지났어요',
      '"' || t.book_title || '" 반납이 ' || days_over || '일 지났어요. 책 주인과 약속을 잡아주세요.',
      jsonb_build_object('transaction_id', t.id, 'days_over', days_over, 'role', 'borrower')
    );

    -- 책 주인 — 직접 독촉하지 않아도 되게, 상황만 알려준다
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      t.owner_id,
      'return_overdue',
      '반납이 지연되고 있어요',
      COALESCE(t.borrower_nickname, '이웃') || '님이 빌린 "' || t.book_title || '" 반납이 ' ||
      days_over || '일 지났어요.',
      jsonb_build_object('transaction_id', t.id, 'days_over', days_over, 'role', 'owner')
    );
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 2. 요청 후 무응답 (24시간)
-- ─────────────────────────────────────────────────────────────
-- 요청을 받고 방치하면 요청자는 그냥 떠난다. 초기 서비스에서 1건의 방치는 1명의 이탈이다.
-- "책 주인이 요청 메시지 이후로 이 대화에 아무 말도 안 한 상태"를 무응답으로 본다.

CREATE OR REPLACE FUNCTION public.notify_pending_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT m.id           AS message_id,
           m.conversation_id,
           m.sender_id    AS requester_id,
           m.created_at,
           CASE WHEN c.participant_1 = m.sender_id THEN c.participant_2 ELSE c.participant_1 END AS owner_id,
           substring(m.content FROM '\[BOOK_ID:([^\]]+)\]') AS book_id_txt,
           rp.nickname    AS requester_nickname
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    LEFT JOIN public.profiles rp ON rp.id = m.sender_id
    WHERE m.content ~ '^\[(대여|나눔|구매) 요청\]'
      -- 24시간~48시간 전에 온 요청만 본다 (더 오래된 건 이미 한 번 알렸다)
      AND m.created_at < now() - interval '24 hours'
      AND m.created_at > now() - interval '48 hours'
  LOOP
    -- 책 주인이 그 뒤로 한 마디라도 했으면 무응답이 아니다
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.messages m2
      WHERE m2.conversation_id = r.conversation_id
        AND m2.sender_id = r.owner_id
        AND m2.created_at > r.created_at
    );

    -- 같은 요청으로 이미 리마인드했으면 그만한다 (한 번이면 충분하다)
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.type = 'request_pending'
        AND n.data->>'message_id' = r.message_id::text
    );

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      r.owner_id,
      'request_pending',
      '답변을 기다리고 있어요',
      COALESCE(r.requester_nickname, '이웃') || '님의 요청이 하루째 답변을 기다리고 있어요.',
      jsonb_build_object(
        'message_id',      r.message_id,
        'conversation_id', r.conversation_id,
        'sender_id',       r.requester_id
      )
    );
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 3. 위시리스트 매칭 — 내가 찾던 책이 올라왔을 때
-- ─────────────────────────────────────────────────────────────
-- 이게 없으면 위시리스트는 "적어두고 잊는 곳"이 된다.

CREATE OR REPLACE FUNCTION public.notify_wishlist_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w              RECORD;
  owner_nickname text;
BEGIN
  -- 비공개(커뮤니티 전용) 책은 아무나 볼 수 없으니 매칭 알림도 보내지 않는다.
  -- 못 보는 책을 알려주면 유저는 알림을 눌렀다가 빈손으로 돌아간다.
  IF NOT NEW.is_public THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO owner_nickname FROM public.profiles WHERE id = NEW.owner_id;

  FOR w IN
    SELECT DISTINCT wl.user_id
    FROM public.wishlists wl
    WHERE wl.is_fulfilled = false
      AND wl.user_id <> NEW.owner_id                      -- 내가 올린 내 위시는 무시
      AND lower(trim(wl.title)) = lower(trim(NEW.title))  -- 제목 일치
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      w.user_id,
      'wishlist_match',
      '찾던 책이 올라왔어요!',
      COALESCE(owner_nickname, '이웃') || '님이 "' || NEW.title || '"을(를) 등록했어요.',
      jsonb_build_object('book_id', NEW.id, 'owner_id', NEW.owner_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_wishlist_match ON public.books;
CREATE TRIGGER trg_notify_wishlist_match
  AFTER INSERT ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.notify_wishlist_match();


-- ─────────────────────────────────────────────────────────────
-- 4. 내 커뮤니티에 새 책 등록
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_community_new_book()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m              RECORD;
  owner_nickname text;
  community_name text;
BEGIN
  IF NEW.community_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO owner_nickname FROM public.profiles WHERE id = NEW.owner_id;
  SELECT name INTO community_name FROM public.communities WHERE id = NEW.community_id;

  FOR m IN
    SELECT cm.user_id
    FROM public.community_members cm
    WHERE cm.community_id = NEW.community_id
      AND cm.user_id <> NEW.owner_id   -- 내가 올린 책을 나에게 알리지 않는다
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      m.user_id,
      'community_new_book',
      '새 책이 올라왔어요',
      COALESCE(owner_nickname, '이웃') || '님이 "' || COALESCE(community_name, '커뮤니티') ||
      '"에 "' || NEW.title || '"을(를) 등록했어요.',
      jsonb_build_object('book_id', NEW.id, 'community_id', NEW.community_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_community_new_book ON public.books;
CREATE TRIGGER trg_notify_community_new_book
  AFTER INSERT ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.notify_community_new_book();


-- ─────────────────────────────────────────────────────────────
-- 매일 도는 작업 하나로 묶는다
-- ─────────────────────────────────────────────────────────────
-- cron 작업을 여러 개 두면 어느 게 돌았는지 추적이 어렵다. 하나로 모은다.

CREATE OR REPLACE FUNCTION public.run_daily_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_due_returns();      -- 반납 임박 (D-1, D-day)
  PERFORM public.notify_overdue_returns();  -- 반납 연체 (D+1, D+3, 주 1회)
  PERFORM public.notify_pending_requests(); -- 요청 후 24시간 무응답
END;
$$;

-- 기존 작업(반납 임박만 돌던 것)을 통합 작업으로 교체한다
SELECT cron.unschedule('notify-due-returns')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-due-returns');

SELECT cron.unschedule('moa-daily-notifications')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'moa-daily-notifications');

-- 매일 오전 9시 (싱가포르 시각) = UTC 01:00
SELECT cron.schedule(
  'moa-daily-notifications',
  '0 1 * * *',
  $$ SELECT public.run_daily_notifications(); $$
);
