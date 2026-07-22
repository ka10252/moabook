-- 알림 문구를 사람이 쓴 말투로 고친다.
--
-- 고치는 원칙:
--   1) 사람을 주어로. "요청이 기다리고 있어요"는 요청이 사람처럼 구는 문장이라 어색하다.
--      → "dlee님이 어제 요청했어요"
--   2) 모드별로 맞는 동사. 대여/나눔/구매는 하는 행동이 다르다.
--      → 빌리고 싶어해요 / 받고 싶어해요 / 사고 싶어해요
--   3) 무엇에 대한 알림인지 본문만 봐도 알게. 책 제목이 없으면 눌러보기 전엔 모른다.


-- ─────────────────────────────────────────────────────────────
-- 요청 / 수락 / 반납요청 / 메시지
-- ─────────────────────────────────────────────────────────────

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
  action_word     text;
  want_verb       text;
  notif_type      text;
  notif_title     text;
  notif_body      text;
BEGIN
  SELECT * INTO conv_row FROM public.conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  receiver_id := CASE WHEN conv_row.participant_1 = NEW.sender_id
                      THEN conv_row.participant_2 ELSE conv_row.participant_1 END;

  SELECT nickname INTO sender_nickname FROM public.profiles WHERE id = NEW.sender_id;
  sender_nickname := COALESCE(sender_nickname, '이웃');

  book_id_txt := substring(NEW.content FROM '\[BOOK_ID:([^\]]+)\]');
  IF book_id_txt IS NOT NULL THEN
    SELECT title INTO book_title FROM public.books WHERE id = book_id_txt::uuid;
  END IF;
  book_title := COALESCE(book_title, '책');

  msg_body := trim(regexp_replace(NEW.content, '\[BOOK_ID:[^\]]+\]', '', 'g'));
  prefix   := substring(msg_body FROM '^\[([^\]]+)\]');

  IF prefix IS NULL THEN
    notif_type  := 'new_message';
    notif_title := '💬 ' || sender_nickname;
    notif_body  := left(msg_body, 80);

  ELSIF prefix IN ('대여 요청', '나눔 요청', '구매 요청') THEN
    action_word := split_part(prefix, ' ', 1);          -- 대여 / 나눔 / 구매
    -- 하는 행동이 다르면 쓰는 말도 달라야 한다
    want_verb := CASE action_word
                   WHEN '대여' THEN '빌리고 싶어해요'
                   WHEN '나눔' THEN '받고 싶어해요'
                   ELSE            '사고 싶어해요'
                 END;
    notif_type  := 'book_request';
    notif_title := '📚 ' || action_word || ' 요청';
    notif_body  := sender_nickname || '님이 "' || book_title || '"' ||
                   public.ko_particle(book_title, '을', '를') || ' ' || want_verb;

  ELSIF prefix = '대여 수락' THEN
    notif_type  := 'request_accepted';
    notif_title := '✅ 대여 수락';
    notif_body  := sender_nickname || '님이 "' || book_title || '"' ||
                   public.ko_particle(book_title, '을', '를') || ' 빌려주기로 했어요';

  ELSIF prefix = '반납 요청' THEN
    notif_type  := 'return_requested';
    notif_title := '🔄 반납 요청';
    notif_body  := sender_nickname || '님이 "' || book_title || '"' ||
                   public.ko_particle(book_title, '을', '를') || ' 돌려받고 싶어해요';

  ELSE
    RETURN NEW;   -- [반납 완료] 같은 사후 통보는 잠금화면을 울릴 일이 아니다
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    receiver_id, notif_type, notif_title, notif_body,
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
-- 반납 임박
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_due_returns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t           RECORD;
  days_left   int;
  notif_title text;
  notif_body  text;
BEGIN
  FOR t IN
    SELECT tx.id, tx.borrower_id, tx.end_date, b.title AS book_title
    FROM public.transactions tx
    JOIN public.books b ON b.id = tx.book_id
    WHERE tx.status = 'active' AND tx.type = 'rent'
      AND tx.end_date IS NOT NULL
      AND tx.end_date::date IN (CURRENT_DATE, CURRENT_DATE + 1)
  LOOP
    days_left := t.end_date::date - CURRENT_DATE;

    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = t.borrower_id AND n.type = 'return_due'
        AND n.data->>'transaction_id' = t.id::text
        AND n.created_at::date = CURRENT_DATE
    );

    IF days_left = 0 THEN
      notif_title := '⏰ 오늘이 반납일이에요';
      notif_body  := '"' || t.book_title || '" 돌려줄 약속을 잡아보세요';
    ELSE
      notif_title := '⏰ 내일이 반납일이에요';
      notif_body  := '"' || t.book_title || '" 돌려줄 준비를 해주세요';
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      t.borrower_id, 'return_due', notif_title, notif_body,
      jsonb_build_object('transaction_id', t.id, 'days_left', days_left)
    );
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 반납 연체 — 빌린 사람에겐 부드럽게, 책 주인에겐 사실만
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_overdue_returns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t         RECORD;
  days_over int;
BEGIN
  FOR t IN
    SELECT tx.id, tx.borrower_id, tx.owner_id, tx.end_date,
           b.title AS book_title, bp.nickname AS borrower_nickname
    FROM public.transactions tx
    JOIN public.books b ON b.id = tx.book_id
    LEFT JOIN public.profiles bp ON bp.id = tx.borrower_id
    WHERE tx.status = 'active' AND tx.type = 'rent'
      AND tx.end_date IS NOT NULL
      AND tx.end_date::date < CURRENT_DATE
  LOOP
    days_over := CURRENT_DATE - t.end_date::date;

    -- D+1, D+3, 이후 주 1회. 매일 울리면 알림 자체를 꺼버린다.
    CONTINUE WHEN NOT (days_over IN (1, 3) OR days_over % 7 = 0);
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.type = 'return_overdue'
        AND n.data->>'transaction_id' = t.id::text
        AND n.created_at::date = CURRENT_DATE
    );

    -- 빌린 사람 — 몰아세우지 않는다. 대부분은 잊은 것뿐이다.
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      t.borrower_id, 'return_overdue',
      '📕 반납일이 ' || days_over || '일 지났어요',
      '"' || t.book_title || '" 반납이 늦어지고 있어요',
      jsonb_build_object('transaction_id', t.id, 'days_over', days_over, 'role', 'borrower')
    );

    -- 책 주인 — 직접 독촉하지 않아도 되게, 사실만 알린다
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      t.owner_id, 'return_overdue',
      '📕 반납이 ' || days_over || '일 늦어지고 있어요',
      COALESCE(t.borrower_nickname, '이웃') || '님이 "' || t.book_title || '"' ||
      public.ko_particle(t.book_title, '을', '를') || ' 아직 반납하지 않았어요',
      jsonb_build_object('transaction_id', t.id, 'days_over', days_over, 'role', 'owner')
    );
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 요청 후 무응답 — "요청이 기다리고 있어요"는 어색하다. 사람을 주어로.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_pending_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r           RECORD;
  book_title  text;
  action_word text;
BEGIN
  FOR r IN
    SELECT m.id AS message_id, m.conversation_id, m.sender_id AS requester_id,
           m.created_at, m.content,
           CASE WHEN c.participant_1 = m.sender_id THEN c.participant_2 ELSE c.participant_1 END AS owner_id,
           rp.nickname AS requester_nickname
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    LEFT JOIN public.profiles rp ON rp.id = m.sender_id
    WHERE m.content ~ '^\[(대여|나눔|구매) 요청\]'
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
    -- 한 번이면 충분하다. 두 번 조르면 그건 잔소리다.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.type = 'request_pending' AND n.data->>'message_id' = r.message_id::text
    );

    -- 무슨 책 얘기인지 본문에 담는다. 없으면 눌러보기 전엔 알 수 없다.
    book_title := NULL;
    SELECT b.title INTO book_title FROM public.books b
    WHERE b.id = (substring(r.content FROM '\[BOOK_ID:([^\]]+)\]'))::uuid;
    action_word := COALESCE(substring(r.content FROM '^\[(대여|나눔|구매) 요청\]'), '대여');

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      r.owner_id, 'request_pending',
      '⏳ 답장하지 않은 요청이 있어요',
      COALESCE(r.requester_nickname, '이웃') || '님이 어제 "' ||
      COALESCE(book_title, '책') || '" ' || action_word ||
      public.ko_particle(action_word, '을', '를') || ' 요청했어요',
      jsonb_build_object(
        'message_id',      r.message_id,
        'conversation_id', r.conversation_id,
        'sender_id',       r.requester_id
      )
    );
  END LOOP;
END;
$$;
