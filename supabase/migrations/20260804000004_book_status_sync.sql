-- 책 상태(book.status)를 거래(transactions)로부터 자동 동기화.
--
-- 배경: book.status는 지금까지 클라이언트에서만, 그것도 비원자적으로 갱신됐다.
--   대여를 '취소'하거나 거래 row를 지우면 status가 'rented'로 굳어,
--   얽힌 거래가 없는데도 책이 '대여중(빌려줄 수 없음)'으로 남는 버그가 있었다.
-- 해결: 거래가 바뀔 때마다 해당 책의 상태를 규칙으로 재계산하는 트리거.

CREATE OR REPLACE FUNCTION public.recompute_book_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book   uuid := COALESCE(NEW.book_id, OLD.book_id);
  v_status public.book_status;
BEGIN
  IF v_book IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE book_id = v_book AND type = 'purchase' AND status IN ('active', 'completed')
  ) THEN
    v_status := 'sold';
  ELSIF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE book_id = v_book AND type = 'rent' AND status IN ('pending', 'active')
  ) THEN
    v_status := 'rented';
  ELSE
    v_status := 'available';
  END IF;

  UPDATE public.books
  SET status = v_status
  WHERE id = v_book AND status IS DISTINCT FROM v_status;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_book_status ON public.transactions;
CREATE TRIGGER trg_recompute_book_status
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.recompute_book_status();

-- ── 이미 굳어버린 책 복구 ──────────────────────────────────────
-- 진행 중인 대여 거래가 없는데 'rented'로 남은 책 → 'available'로 되돌린다.
UPDATE public.books b
SET status = 'available'
WHERE b.status = 'rented'
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.book_id = b.id AND t.type = 'rent' AND t.status IN ('pending', 'active')
  );
