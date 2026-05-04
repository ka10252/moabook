-- ============================================================
-- moabook 더미 메시지 시드 데이터
-- Supabase SQL Editor에서 실행하세요
-- 실행 전: 앱에서 테스트 계정 2개 가입 필요
-- ============================================================

DO $$
DECLARE
  user_a UUID;
  user_b UUID;
  conv_id UUID;
  book_id UUID;
BEGIN

  -- profiles 테이블에서 첫 번째 두 유저 가져오기
  SELECT id INTO user_a FROM profiles ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO user_b FROM profiles ORDER BY created_at ASC OFFSET 1 LIMIT 1;

  IF user_a IS NULL OR user_b IS NULL THEN
    RAISE EXCEPTION '테스트 계정이 2개 이상 필요합니다. 앱에서 계정을 먼저 생성해주세요.';
  END IF;

  -- 테스트용 책 가져오기 (없으면 더미 책 생성)
  SELECT id INTO book_id FROM books WHERE owner_id = user_a LIMIT 1;

  IF book_id IS NULL THEN
    INSERT INTO books (title, author, condition, mode, status, owner_id, is_public)
    VALUES ('테스트 책 - 코스모스', '칼 세이건', 'A', 'rent', 'available', user_a, true)
    RETURNING id INTO book_id;
  END IF;

  -- 기존 대화 확인 또는 새 대화 생성
  SELECT id INTO conv_id
  FROM conversations
  WHERE (participant_1 = user_a AND participant_2 = user_b)
     OR (participant_1 = user_b AND participant_2 = user_a)
  LIMIT 1;

  IF conv_id IS NULL THEN
    INSERT INTO conversations (participant_1, participant_2, book_id, last_message_at)
    VALUES (user_a, user_b, book_id, NOW() - INTERVAL '2 days')
    RETURNING id INTO conv_id;
  END IF;

  -- 기존 메시지 제거 (재실행 시 중복 방지)
  DELETE FROM messages WHERE conversation_id = conv_id;

  -- ── 더미 메시지 삽입 ────────────────────────────────────
  -- 1. 일반 대화
  INSERT INTO messages (conversation_id, sender_id, content, is_read, created_at) VALUES
    (conv_id, user_b, '안녕하세요! 책 아직 대여 가능한가요?', true, NOW() - INTERVAL '2 days'),
    (conv_id, user_a, '네, 가능해요! 언제쯤 수령 가능하세요?', true, NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),
    (conv_id, user_b, '이번 주말 가능합니다 😊', true, NOW() - INTERVAL '2 days' + INTERVAL '10 minutes'),
    (conv_id, user_a, '좋아요! 그럼 아래 요청 보내주세요', true, NOW() - INTERVAL '2 days' + INTERVAL '15 minutes');

  -- 2. 대여 요청 메시지 (특수 카드)
  INSERT INTO messages (conversation_id, sender_id, content, is_read, created_at) VALUES
    (conv_id, user_b,
     CONCAT('[대여 요청] ', (SELECT nickname FROM profiles WHERE id = user_b), '님이 대여를 요청합니다. [BOOK_ID:', book_id, ']'),
     true, NOW() - INTERVAL '1 day' + INTERVAL '2 hours');

  -- 3. 대여 수락 메시지 (특수 카드)
  INSERT INTO messages (conversation_id, sender_id, content, is_read, created_at) VALUES
    (conv_id, user_a,
     CONCAT('[대여 수락] 책: 테스트 책 - 코스모스 | 대여일: 2026년 5월 3일 | 반납예정일: 2026년 6월 3일 [BOOK_ID:', book_id, ']'),
     true, NOW() - INTERVAL '1 day' + INTERVAL '3 hours');

  -- 4. 대여 수락 이후 일반 대화
  INSERT INTO messages (conversation_id, sender_id, content, is_read, created_at) VALUES
    (conv_id, user_b, '감사합니다! 잘 읽을게요 📚', true, NOW() - INTERVAL '1 day' + INTERVAL '3 hours' + INTERVAL '5 minutes'),
    (conv_id, user_a, '재미있게 읽으세요~ 반납 전에 미리 연락 부탁드려요', true, NOW() - INTERVAL '1 day' + INTERVAL '3 hours' + INTERVAL '10 minutes');

  -- 5. 반납 요청 메시지 (특수 카드)
  INSERT INTO messages (conversation_id, sender_id, content, is_read, created_at) VALUES
    (conv_id, user_b,
     CONCAT('[반납 요청] 책: 테스트 책 - 코스모스 을 반납하겠습니다. [BOOK_ID:', book_id, ']'),
     false, NOW() - INTERVAL '1 hour');

  -- 6. 미읽음 상태의 최신 메시지 (알림 테스트용)
  INSERT INTO messages (conversation_id, sender_id, content, is_read, created_at) VALUES
    (conv_id, user_b, '혹시 내일 반납 가능할까요?', false, NOW() - INTERVAL '30 minutes');

  -- 대화방 last_message_at 업데이트
  UPDATE conversations SET last_message_at = NOW() - INTERVAL '30 minutes' WHERE id = conv_id;

  RAISE NOTICE '✅ 완료! conversation_id: %, user_a: %, user_b: %', conv_id, user_a, user_b;

END $$;
