-- ============================================================
-- moabook 책장 데모 시드 데이터
-- 테스터A의 책장에 3가지 상태를 표시하기 위한 데이터:
--   1. 내가 등록한 책 (소유, available)
--   2. 내가 빌려준 책 (소유, rented out to B)
--   3. 내가 빌린 책  (B 소유, A가 borrower)
-- ============================================================

DO $$
DECLARE
  user_a UUID;
  user_b UUID;
  book_a_available_id UUID;
  book_a_lent_id UUID;
  book_b_id UUID;
BEGIN
  -- 테스터A, B ID 가져오기
  SELECT id INTO user_a FROM profiles WHERE nickname = '테스터A' LIMIT 1;
  SELECT id INTO user_b FROM profiles WHERE nickname = '테스터B' LIMIT 1;

  IF user_a IS NULL OR user_b IS NULL THEN
    RAISE EXCEPTION '테스터A 또는 테스터B 계정을 찾을 수 없습니다.';
  END IF;

  -- 기존 데모 책/거래 정리 (재실행 안전)
  DELETE FROM transactions
  WHERE (owner_id = user_a OR borrower_id = user_a)
    AND (owner_id = user_b OR borrower_id = user_b);

  -- 1. 테스터A 소유 책 (대여 가능)
  INSERT INTO books (title, author, condition, mode, status, owner_id, is_public)
  VALUES ('채식주의자', '한강', 'A', 'rent', 'available', user_a, true)
  RETURNING id INTO book_a_available_id;

  -- 2. 테스터A 소유 책 (B에게 빌려줄 책)
  INSERT INTO books (title, author, condition, mode, status, owner_id, is_public)
  VALUES ('82년생 김지영', '조남주', 'S', 'rent', 'rented', user_a, true)
  RETURNING id INTO book_a_lent_id;

  -- 3. 테스터B 소유 책 (A가 빌릴 책)
  INSERT INTO books (title, author, condition, mode, status, owner_id, is_public)
  VALUES ('데미안', '헤르만 헤세', 'B', 'rent', 'rented', user_b, true)
  RETURNING id INTO book_b_id;

  -- 거래1: A → B (A가 빌려줌, 빌려준 책 표시용)
  INSERT INTO transactions (book_id, owner_id, borrower_id, type, status, start_date, return_date)
  VALUES (book_a_lent_id, user_a, user_b, 'rent', 'active',
          NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days');

  -- 거래2: B → A (A가 빌림, 빌린 책 표시용)
  INSERT INTO transactions (book_id, owner_id, borrower_id, type, status, start_date, return_date)
  VALUES (book_b_id, user_b, user_a, 'rent', 'active',
          NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days');

  RAISE NOTICE '✅ 완료!';
  RAISE NOTICE '  테스터A 소유 (available): %', book_a_available_id;
  RAISE NOTICE '  테스터A 소유 (B에게 빌려줌): %', book_a_lent_id;
  RAISE NOTICE '  테스터B 소유 (A가 빌림): %', book_b_id;
END $$;
