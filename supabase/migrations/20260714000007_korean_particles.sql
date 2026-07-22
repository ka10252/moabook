-- 알림 문구 정리: 조사 + 간결화 + 이모지
--
-- 문제 1) "대여을(를) 요청했어요" — 을(를) 표기는 "이건 기계가 쓴 문장"이라고 광고하는 것과 같다.
-- 문제 2) 문장이 길다. 잠금화면 알림은 1초 안에 안 읽히면 그냥 지워진다.
--         제목은 "무슨 일인지", 본문은 "누가·무슨 책인지"만 담는다.
-- 문제 3) 이모지가 없어서 알림 목록에서 종류가 한눈에 구분되지 않는다.


-- ─────────────────────────────────────────────────────────────
-- 한국어 조사
-- ─────────────────────────────────────────────────────────────
-- 한글 음절은 유니코드 0xAC00부터 (초성×588 + 중성×28 + 종성) 순으로 배열된다.
-- 따라서 (코드 - 0xAC00) % 28 이 0이면 받침이 없다.

CREATE OR REPLACE FUNCTION public.ko_particle(word text, with_batchim text, without_batchim text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cp int;
BEGIN
  IF word IS NULL OR btrim(word) = '' THEN
    RETURN without_batchim;
  END IF;

  cp := ascii(right(btrim(word), 1));

  -- 한글 밖(영어·숫자)이면 판정할 수 없다. 더 흔한 쪽을 쓴다 — 영어로 끝나는 책 제목이 많다.
  IF cp < 44032 OR cp > 55203 THEN
    RETURN without_batchim;
  END IF;

  RETURN CASE WHEN (cp - 44032) % 28 <> 0 THEN with_batchim ELSE without_batchim END;
END;
$$;

COMMENT ON FUNCTION public.ko_particle IS
  '한글 받침 여부로 조사를 고른다. ko_particle(''대여'', ''을'', ''를'') → ''를''';


-- ─────────────────────────────────────────────────────────────
-- 메시지 계열 — 요청 / 수락 / 반납요청 / 일반 메시지
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
    action_word := split_part(prefix, ' ', 1);   -- 대여 / 나눔 / 구매
    notif_type  := 'book_request';
    notif_title := '📚 ' || action_word || ' 요청';
    notif_body  := sender_nickname || '님이 "' || book_title || '"' ||
                   public.ko_particle(book_title, '을', '를') || ' 원해요';

  ELSIF prefix = '대여 수락' THEN
    notif_type  := 'request_accepted';
    notif_title := '✅ 대여 수락';
    notif_body  := sender_nickname || '님이 "' || book_title || '" 대여를 수락했어요';

  ELSIF prefix = '반납 요청' THEN
    notif_type  := 'return_requested';
    notif_title := '🔄 반납 요청';
    notif_body  := sender_nickname || '님이 "' || book_title || '" 반납을 기다려요';

  ELSE
    -- [반납 완료] 같은 사후 통보는 잠금화면을 울릴 일이 아니다
    RETURN NEW;
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
-- 위시 매칭 / 커뮤니티 새 책
-- ─────────────────────────────────────────────────────────────

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
  -- 비공개 책은 알려봐야 열어볼 수 없다. 빈손으로 돌아가게 하지 않는다.
  IF NOT NEW.is_public THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO owner_nickname FROM public.profiles WHERE id = NEW.owner_id;

  FOR w IN
    SELECT DISTINCT wl.user_id
    FROM public.wishlists wl
    WHERE wl.is_fulfilled = false
      AND wl.user_id <> NEW.owner_id
      AND lower(trim(wl.title)) = lower(trim(NEW.title))
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      w.user_id,
      'wishlist_match',
      '✨ 찾던 책이 나왔어요',
      COALESCE(owner_nickname, '이웃') || '님이 "' || NEW.title || '"' ||
      public.ko_particle(NEW.title, '을', '를') || ' 올렸어요',
      jsonb_build_object('book_id', NEW.id, 'owner_id', NEW.owner_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;


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
      AND cm.user_id <> NEW.owner_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      m.user_id,
      'community_new_book',
      '📖 ' || COALESCE(community_name, '커뮤니티') || '에 새 책',
      COALESCE(owner_nickname, '이웃') || '님이 "' || NEW.title || '"' ||
      public.ko_particle(NEW.title, '을', '를') || ' 올렸어요',
      jsonb_build_object('book_id', NEW.id, 'community_id', NEW.community_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 반납 임박 / 연체 / 무응답
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
    WHERE tx.status = 'active'
      AND tx.type = 'rent'
      AND tx.end_date IS NOT NULL
      AND tx.end_date::date IN (CURRENT_DATE, CURRENT_DATE + 1)
  LOOP
    days_left := t.end_date::date - CURRENT_DATE;

    -- 오늘 이미 보냈으면 또 보내지 않는다
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = t.borrower_id
        AND n.type = 'return_due'
        AND n.data->>'transaction_id' = t.id::text
        AND n.created_at::date = CURRENT_DATE
    );

    IF days_left = 0 THEN
      notif_title := '⏰ 오늘이 반납일';
    ELSE
      notif_title := '⏰ 내일이 반납일';
    END IF;
    notif_body := '"' || t.book_title || '" 반납 약속을 잡아주세요';

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      t.borrower_id, 'return_due', notif_title, notif_body,
      jsonb_build_object('transaction_id', t.id, 'days_left', days_left)
    );
  END LOOP;
END;
$$;


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

    -- D+1, D+3, 이후 주 1회. 매일 울리면 알림 자체를 꺼버린다.
    CONTINUE WHEN NOT (days_over IN (1, 3) OR days_over % 7 = 0);

    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.type = 'return_overdue'
        AND n.data->>'transaction_id' = t.id::text
        AND n.created_at::date = CURRENT_DATE
    );

    -- 빌린 사람 — 재촉이 아니라 상기시키는 톤
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      t.borrower_id, 'return_overdue',
      '📕 반납일 ' || days_over || '일 지남',
      '"' || t.book_title || '" 책 주인이 기다리고 있어요',
      jsonb_build_object('transaction_id', t.id, 'days_over', days_over, 'role', 'borrower')
    );

    -- 책 주인 — 직접 독촉하지 않아도 되게, 상황만 알려준다
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      t.owner_id, 'return_overdue',
      '📕 반납 지연 ' || days_over || '일',
      COALESCE(t.borrower_nickname, '이웃') || '님이 빌린 "' || t.book_title || '"',
      jsonb_build_object('transaction_id', t.id, 'days_over', days_over, 'role', 'owner')
    );
  END LOOP;
END;
$$;


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
           rp.nickname    AS requester_nickname
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
      WHERE n.type = 'request_pending'
        AND n.data->>'message_id' = r.message_id::text
    );

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      r.owner_id, 'request_pending',
      '⏳ 답변을 기다려요',
      COALESCE(r.requester_nickname, '이웃') || '님의 요청이 하루째 기다리고 있어요',
      jsonb_build_object(
        'message_id',      r.message_id,
        'conversation_id', r.conversation_id,
        'sender_id',       r.requester_id
      )
    );
  END LOOP;
END;
$$;
