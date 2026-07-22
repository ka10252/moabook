-- 온보딩에서 약속한 알림 중 실제로 안 가고 있던 두 가지를 살린다.
--
--   1) "이웃이 내 책을 빌리고 싶어할 때"  ← 시스템 메시지라고 걸러지고 있었다
--   2) "빌린 책의 반납일이 다가올 때"      ← 아예 만든 적이 없다 (이벤트가 아니라 시각이 트리거라 cron 필요)
--
-- notifications 테이블에 행이 생기면 앞서 만든 trg_notifications_push 가 잠금화면 푸시까지 보낸다.
-- 즉 여기서는 "알림 행을 만드는 것"만 신경 쓰면 된다.


-- ─────────────────────────────────────────────────────────────
-- 1. 대여·나눔·구매 요청 알림
-- ─────────────────────────────────────────────────────────────
-- 기존 함수는 '['로 시작하는 메시지를 전부 시스템 메시지로 보고 건너뛰었다.
-- 그런데 정작 가장 중요한 "[대여 요청]"이 거기 섞여 있었다.
-- → 요청 계열은 알림을 보내고, 상태 통보 계열([반납 완료] 등)만 조용히 넘긴다.

CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_row        RECORD;
  receiver_id     uuid;
  sender_nickname text;
  msg_body        text;
  book_id_txt     text;
  book_title      text;
  prefix          text;
  notif_type      text;
  notif_title     text;
  notif_body      text;
BEGIN
  SELECT * INTO conv_row FROM public.conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF conv_row.participant_1 = NEW.sender_id THEN
    receiver_id := conv_row.participant_2;
  ELSE
    receiver_id := conv_row.participant_1;
  END IF;

  SELECT nickname INTO sender_nickname FROM public.profiles WHERE id = NEW.sender_id;
  sender_nickname := COALESCE(sender_nickname, '이웃');

  -- [BOOK_ID:...] 태그에서 책을 알아낸다 — "누가" 만큼 "무슨 책"이 중요하다
  book_id_txt := substring(NEW.content FROM '\[BOOK_ID:([^\]]+)\]');
  IF book_id_txt IS NOT NULL THEN
    SELECT title INTO book_title FROM public.books WHERE id = book_id_txt::uuid;
  END IF;

  msg_body := trim(regexp_replace(NEW.content, '\[BOOK_ID:[^\]]+\]', '', 'g'));
  prefix   := substring(msg_body FROM '^\[([^\]]+)\]');

  IF prefix IS NULL THEN
    -- 일반 대화 메시지
    notif_type  := 'new_message';
    notif_title := sender_nickname || '님의 메시지';
    notif_body  := left(msg_body, 80);

  ELSIF prefix IN ('대여 요청', '나눔 요청', '구매 요청') THEN
    -- 요청은 상대가 행동해줘야 진행된다 → 반드시 알려야 한다
    notif_type  := 'book_request';
    notif_title := prefix || '이 왔어요';
    notif_body  := sender_nickname || '님이 "' || COALESCE(book_title, '책') || '" ' ||
                   split_part(prefix, ' ', 1) || '을(를) 요청했어요.';

  ELSIF prefix = '대여 수락' THEN
    notif_type  := 'request_accepted';
    notif_title := '대여가 수락됐어요';
    notif_body  := sender_nickname || '님이 "' || COALESCE(book_title, '책') || '" 대여를 수락했어요.';

  ELSIF prefix = '반납 요청' THEN
    notif_type  := 'return_requested';
    notif_title := '반납 요청이 왔어요';
    notif_body  := sender_nickname || '님이 "' || COALESCE(book_title, '책') || '" 반납을 요청했어요.';

  ELSE
    -- [반납 완료], [판매 완료] 같은 사후 통보는 굳이 잠금화면을 울리지 않는다
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    receiver_id,
    notif_type,
    notif_title,
    notif_body,
    jsonb_build_object(
      'sender_id',       NEW.sender_id,
      'conversation_id', NEW.conversation_id,
      'book_id',         book_id_txt
    )
  );

  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 2. 반납 임박 알림 (D-1 / D-day)
-- ─────────────────────────────────────────────────────────────
-- 트리거는 "무슨 일이 벌어졌을 때" 돈다. 반납일은 아무 일도 안 벌어져도 다가온다.
-- 그래서 매일 한 번 훑어보는 예약 작업이 필요하다.

CREATE OR REPLACE FUNCTION public.notify_due_returns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t          RECORD;
  days_left  int;
  notif_title text;
  notif_body  text;
BEGIN
  FOR t IN
    SELECT tx.id, tx.borrower_id, tx.end_date, b.title AS book_title
    FROM public.transactions tx
    JOIN public.books b ON b.id = tx.book_id
    WHERE tx.status = 'active'
      AND tx.type = 'rent'
      AND tx.end_date IS NOT NULL
      -- 오늘 반납(D-day) 또는 내일 반납(D-1)인 것만
      AND tx.end_date::date IN (CURRENT_DATE, CURRENT_DATE + 1)
  LOOP
    days_left := t.end_date::date - CURRENT_DATE;

    -- 같은 거래에 대해 오늘 이미 보냈으면 또 보내지 않는다
    -- (cron이 두 번 돌거나 수동으로 실행해도 중복 알림이 가지 않도록)
    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = t.borrower_id
        AND n.type = 'return_due'
        AND n.data->>'transaction_id' = t.id::text
        AND n.created_at::date = CURRENT_DATE
    ) THEN
      CONTINUE;
    END IF;

    IF days_left = 0 THEN
      notif_title := '오늘이 반납일이에요';
      notif_body  := '"' || t.book_title || '" 반납일이 오늘이에요. 책 주인과 약속을 잡아보세요.';
    ELSE
      notif_title := '반납일이 내일이에요';
      notif_body  := '"' || t.book_title || '" 반납일이 하루 남았어요.';
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      t.borrower_id,
      'return_due',
      notif_title,
      notif_body,
      jsonb_build_object('transaction_id', t.id, 'days_left', days_left)
    );
  END LOOP;
END;
$$;


-- 매일 오전 9시(싱가포르 시각)에 실행.
-- cron은 UTC로 돌므로 SGT 09:00 = UTC 01:00 이다.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('notify-due-returns')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-due-returns');

SELECT cron.schedule(
  'notify-due-returns',
  '0 1 * * *',
  $$ SELECT public.notify_due_returns(); $$
);
