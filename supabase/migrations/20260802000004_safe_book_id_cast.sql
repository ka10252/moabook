-- 메시지 본문의 [BOOK_ID:xxx]에서 뽑은 값을 uuid로 무방비 캐스트하던 곳을 방어한다.
--
-- 문제: notify_on_new_message는 messages AFTER INSERT 트리거다. 여기서 book_id_txt::uuid가
--       실패하면(비-UUID 값이 들어오면) 트리거가 예외를 던지고 → 그 메시지 INSERT가 통째로 롤백된다.
--       = 대여/구매/나눔 요청·수락·반납 메시지가 저장 안 됨 = 핵심 거래가 마비.
--       클라가 항상 정상 UUID를 보내더라도, 한 건의 이상 데이터가 채팅 전체를 막게 두면 안 된다.
--
-- 해결: 캐스트 실패 시 NULL을 돌려주는 safe_uuid()로 바꾼다. id = NULL 조회는 0행이라
--       book_title이 기본값('책')으로 떨어질 뿐, 메시지 저장은 절대 막지 않는다.

-- ── 안전 캐스트 헬퍼 ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.safe_uuid(p text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- ── 1) 메시지 트리거(치명적 경로) — 캐스트만 safe_uuid로 교체 ──
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
    -- ⚠️ 무방비 ::uuid → safe_uuid (비-UUID여도 트리거가 죽지 않게)
    SELECT title INTO book_title FROM public.books WHERE id = public.safe_uuid(book_id_txt);
  END IF;
  book_title := COALESCE(book_title, '책');

  msg_body := trim(regexp_replace(NEW.content, '\[BOOK_ID:[^\]]+\]', '', 'g'));
  prefix   := substring(msg_body FROM '^\[([^\]]+)\]');

  IF prefix IS NULL THEN
    notif_type  := 'new_message';
    notif_title := '💬 ' || sender_nickname;
    notif_body  := left(msg_body, 80);

  ELSIF prefix IN ('대여 요청', '나눔 요청', '구매 요청') THEN
    action_word := split_part(prefix, ' ', 1);
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

-- ── 2) 무응답 요청 크론 — 같은 무방비 캐스트 교체 ─────────────
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
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.messages m2
      WHERE m2.conversation_id = r.conversation_id
        AND m2.sender_id = r.owner_id
        AND m2.created_at > r.created_at
    );
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.type = 'request_pending' AND n.data->>'message_id' = r.message_id::text
    );

    book_title := NULL;
    -- ⚠️ 무방비 ::uuid → safe_uuid
    SELECT b.title INTO book_title FROM public.books b
    WHERE b.id = public.safe_uuid(substring(r.content FROM '\[BOOK_ID:([^\]]+)\]'));
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
