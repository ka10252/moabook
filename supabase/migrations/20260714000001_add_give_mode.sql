-- 나눔(무료 양도) 모드 추가
--
-- 거래 방식은 이제 3가지다:
--   rent — 대여 (무료, 돌려받음)
--   give — 나눔 (무료, 안 돌려받음 = 소유권 이전)
--   sell — 판매 (S$, 소유권 이전)
--
-- 나눔은 거래 기록상 '소유권이 넘어간다'는 점에서 판매와 같으므로,
-- transactions.type 은 기존 'purchase' 를 그대로 쓴다 (price 만 null).
-- 새 enum 값을 만들지 않는 이유: 반납·완료 처리 로직을 그대로 재사용하기 위함.

ALTER TYPE public.book_mode ADD VALUE IF NOT EXISTS 'give';

-- 판매가 아닌 책에 가격이 남아 있으면 화면에 S$0 같은 게 뜬다. 정리해 둔다.
UPDATE public.books SET price = NULL WHERE mode <> 'sell' AND price IS NOT NULL;
