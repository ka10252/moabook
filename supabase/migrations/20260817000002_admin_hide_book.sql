-- 관리자가 책을 숨길 수 있게 한다.
--
-- 지금은 신고를 받아도 관리자가 할 수 있는 게 없다 — 책 삭제는 주인만 가능하다.
-- 삭제가 아니라 숨김인 이유:
--   ① 오판이었을 때 되돌릴 수 있어야 한다
--   ② 거래 이력이 걸린 책을 지우면 대화·거래 기록이 함께 깨진다

ALTER TABLE public.books ADD COLUMN IF NOT EXISTS hidden_at        timestamptz;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS hidden_reason    text;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS hidden_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_books_hidden_at ON public.books(hidden_at) WHERE hidden_at IS NOT NULL;

-- ⚠️ 정책을 새로 "추가"하면 안 된다. RLS의 여러 SELECT 정책은 OR로 합쳐져서,
--    기존 정책이 숨긴 책을 그대로 통과시킨다. 기존 정책 자체를 다시 만든다.
--
-- 숨긴 책은 남에게 안 보이지만 **주인에게는 보인다**.
-- 안 보이게 하면 주인은 자기 책이 사라진 줄 알고 다시 올린다 — 같은 문제가 반복된다.
DROP POLICY IF EXISTS "Public books are viewable by everyone" ON public.books;
CREATE POLICY "Public books are viewable by everyone" ON public.books FOR SELECT
USING (
  -- 공개 범위 (기존 조건 그대로)
  (is_public = true OR auth.uid() = owner_id
   OR (community_id IS NOT NULL AND public.is_community_member(auth.uid(), community_id)))
  -- 차단 관계 (기존 조건 그대로)
  AND (auth.uid() IS NULL OR auth.uid() = owner_id OR NOT public.is_blocked_between(auth.uid(), owner_id))
  -- 관리자가 숨긴 책 (이번에 추가)
  AND (hidden_at IS NULL OR auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'))
);

/**
 * 숨기기 / 해제.
 * 관리자만 실행할 수 있고, 누가 왜 숨겼는지 남긴다.
 */
CREATE OR REPLACE FUNCTION public.admin_set_book_hidden(
  p_book_id uuid,
  p_hidden boolean,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  UPDATE public.books
  SET hidden_at     = CASE WHEN p_hidden THEN now() ELSE NULL END,
      hidden_reason = CASE WHEN p_hidden THEN NULLIF(btrim(coalesce(p_reason, '')), '') ELSE NULL END,
      hidden_by     = CASE WHEN p_hidden THEN auth.uid() ELSE NULL END
  WHERE id = p_book_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_book_hidden(uuid, boolean, text) TO authenticated;
