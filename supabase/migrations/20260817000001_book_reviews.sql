-- 책 별점 리뷰 (공개).
--
-- 활동 배지는 "참여했다"는 긍정 신호라 오래 쓴 사람은 다 받는다.
-- 그래서 배지만으로는 "이 책이 괜찮은가"를 못 가린다. 리뷰가 그 자리를 맡는다.
--
-- 유저 리뷰(익명, 사람에 대한 평가)는 별개다 — F3에서 따로 만든다.
-- 여긴 책에 대한 공개 평가만 담는다.

CREATE TABLE IF NOT EXISTS public.book_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 한 사람이 한 책에 하나만. 여러 번 빌려도 리뷰는 갱신이지 추가가 아니다.
  UNIQUE (book_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_book_reviews_book ON public.book_reviews(book_id);
CREATE INDEX IF NOT EXISTS idx_book_reviews_user ON public.book_reviews(user_id);

ALTER TABLE public.book_reviews ENABLE ROW LEVEL SECURITY;

-- 읽기는 전체 공개. 책 상세에서 누구나(게스트 포함) 평균과 목록을 본다.
DROP POLICY IF EXISTS "book_reviews_select_all" ON public.book_reviews;
CREATE POLICY "book_reviews_select_all"
  ON public.book_reviews FOR SELECT
  USING (true);

-- 쓰기는 본인 것만.
DROP POLICY IF EXISTS "book_reviews_insert_own" ON public.book_reviews;
CREATE POLICY "book_reviews_insert_own"
  ON public.book_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "book_reviews_update_own" ON public.book_reviews;
CREATE POLICY "book_reviews_update_own"
  ON public.book_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "book_reviews_delete_own" ON public.book_reviews;
CREATE POLICY "book_reviews_delete_own"
  ON public.book_reviews FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT ON public.book_reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.book_reviews TO authenticated;

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.touch_book_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_book_review ON public.book_reviews;
CREATE TRIGGER trg_touch_book_review
  BEFORE UPDATE ON public.book_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_book_review();

-- 책 상세는 "평균 몇 점, 몇 명"만 있으면 되는데 리뷰를 다 받아오면 낭비다.
-- 목록과 별개로 집계만 주는 뷰를 둔다.
DROP VIEW IF EXISTS public.book_review_stats;
CREATE VIEW public.book_review_stats AS
SELECT
  book_id,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating,
  COUNT(*)::int AS review_count
FROM public.book_reviews
GROUP BY book_id;

GRANT SELECT ON public.book_review_stats TO anon, authenticated;
