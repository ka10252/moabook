-- 반납일 = 실제로 돌려받은 날
--
-- 지금까지 `return_date` 는 **대여를 수락할 때 약속한 예정일**만 담았다. 그래서
--   · 예정일을 안 정하고 빌려준 거래 → 반납이 끝났는데도 거래 현황에 "반납일: 미정"
--   · 예정일보다 늦게 돌려받은 거래 → 기록에는 약속한 날이 남아 실제 날짜를 알 수 없음
-- 이 되었다. 앞으로 이 칸은 **진행 중이면 예정일, 끝났으면 실제 반납일**을 담는다.
--
-- 지난 거래 채우기:
-- 반납을 확인하면 채팅에 `[반납 완료] … [BOOK_ID:…]` 메시지가 남는다. 그게 곧
-- 반납 확인 시각이므로 거기서 가져온다. 같은 책을 여러 번 빌렸을 수 있어
-- **그 거래의 대여 시작일 이후 첫 번째** 메시지를 쓴다.
UPDATE public.transactions t
SET return_date = m.created_at
FROM LATERAL (
  SELECT msg.created_at
  FROM public.messages msg
  WHERE msg.content LIKE '[반납 완료]%'
    AND msg.content LIKE '%[BOOK_ID:' || t.book_id::text || ']%'
    AND msg.created_at >= COALESCE(t.start_date, t.created_at)
  ORDER BY msg.created_at ASC
  LIMIT 1
) m
WHERE t.status = 'completed'
  AND t.type = 'rent'
  AND t.return_date IS DISTINCT FROM m.created_at;

COMMENT ON COLUMN public.transactions.return_date IS
  '진행 중이면 반납 예정일, 완료되면 실제 반납일';
