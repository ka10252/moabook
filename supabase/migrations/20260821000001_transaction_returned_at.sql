-- 실제 반납 확인 시각 (returned_at)
--
-- 왜 새 칸이 필요한가: `return_date` 는 **대여를 수락할 때 정하는 반납 예정일**이다.
-- 실제로 언제 돌려받았는지가 아니다. 그래서 예정일을 안 정하고 빌려준 거래는
-- 거래 현황 히스토리에서 반납이 끝났는데도 "반납일: 미정" 으로 남았다.
-- 예정일을 실제 반납일로 덮어쓰면 "언제까지" 라는 정보가 사라지므로 칸을 나눈다.
--
--   return_date  = 반납 예정일 (수락 시점에 약속한 날)
--   returned_at  = 실제 반납 확인 시각 (책 주인이 '반납 확인' 을 누른 때)

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS returned_at timestamptz;

COMMENT ON COLUMN public.transactions.return_date IS '반납 예정일 — 대여 수락 시 약속한 날';
COMMENT ON COLUMN public.transactions.returned_at IS '실제 반납 확인 시각 — 책 주인이 반납 확인을 누른 때';

-- 지난 거래 채우기.
-- 새 칸이라 과거 기록은 비어 있는데, 반납을 확인하면 채팅에 `[반납 완료] ... [BOOK_ID:…]`
-- 메시지가 남는다. 그게 곧 반납 확인 시각이므로 거기서 가져온다.
-- 같은 책을 여러 번 빌렸을 수 있으니 **그 거래의 대여 시작일 이후 첫 번째** 메시지를 쓴다.
UPDATE public.transactions t
SET returned_at = m.created_at
FROM LATERAL (
  SELECT msg.created_at
  FROM public.messages msg
  WHERE msg.content LIKE '[반납 완료]%'
    AND msg.content LIKE '%[BOOK_ID:' || t.book_id::text || ']%'
    AND msg.created_at >= COALESCE(t.start_date, t.created_at)
  ORDER BY msg.created_at ASC
  LIMIT 1
) m
WHERE t.returned_at IS NULL
  AND t.status = 'completed'
  AND t.type = 'rent';
