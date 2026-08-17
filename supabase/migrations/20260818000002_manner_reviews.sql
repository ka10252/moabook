-- F3 · 거래 상대 익명 매너 평가
--
-- 활동 뱃지는 오래 쓴 사람이면 다 받고 긍정 일색이라 이상 이용자를 걸러내지 못한다.
-- 거래를 끝낸 두 사람이 서로를 별점으로 평가하되, 누가 줬는지는 끝까지 드러나지 않는다.
--
-- 설계에서 지킨 것 네 가지
--  1. 익명 — 평가 원본(reviewer_id 포함)은 클라이언트가 한 줄도 못 읽는다.
--     테이블 권한을 전부 회수하고 집계 RPC만 노출한다. RLS로 SELECT를 막아도
--     reviewer_id가 응답에 실려 나갈 여지를 아예 없애는 쪽이 안전하다.
--  2. 거래한 사람만 — completed 거래가 있어야 평가할 수 있다. 없으면 모르는 사람에게
--     보복성 별점을 뿌릴 수 있다.
--  3. 2개 이상 모여야 공개 — 1개만 있으면 "방금 거래한 그 사람이 준 것"이 자명해서
--     익명이 깨진다. 개수도 그래서 2개 미만이면 감춘다.
--  4. 본인은 자기 평가를 못 본다 — 보면 누가 줬는지 추적하려 들고, 낮은 점수를 두고
--     상대에게 따지는 일이 생긴다.
--
-- 질문은 역할에 따라 2번만 다르다.
--   빌려준 사람(lender)을 평가: ① 약속 ② 책 상태가 설명 그대로였나 ③ 재거래 의향
--   빌린 사람(borrower)을 평가: ① 약속 ② 책을 깨끗하게 보고 돌려줬나 ③ 재거래 의향

CREATE TABLE IF NOT EXISTS public.user_manner_reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- 평가받는 쪽이 그 거래에서 맡았던 역할
  role         text NOT NULL CHECK (role IN ('lender', 'borrower')),
  q1           smallint NOT NULL CHECK (q1 BETWEEN 1 AND 5),
  q2           smallint NOT NULL CHECK (q2 BETWEEN 1 AND 5),
  q3           smallint NOT NULL CHECK (q3 BETWEEN 1 AND 5),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manner_no_self CHECK (reviewer_id <> reviewee_id),
  -- 한 사람에게 한 방향당 하나. 같은 상대와 열 번 거래해도 평가는 한 번이다.
  -- 이게 없으면 거래를 반복해 한 사람 점수를 마음대로 끌어올리거나 내릴 수 있다.
  CONSTRAINT manner_once_per_pair UNIQUE (reviewer_id, reviewee_id, role)
);

CREATE INDEX IF NOT EXISTS user_manner_reviews_reviewee_idx
  ON public.user_manner_reviews (reviewee_id);

ALTER TABLE public.user_manner_reviews ENABLE ROW LEVEL SECURITY;

-- 정책을 하나도 만들지 않는다 = 클라이언트는 아무것도 못 한다. 아래 RPC만이 통로다.
REVOKE ALL ON public.user_manner_reviews FROM anon, authenticated;


-- ─────────────────────────────────────────────────────────────
-- 평가 자격: 상대와 끝낸 거래가 있는가, 그리고 상대는 어느 역할이었나
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manner_review_role(p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN bool_or(t.owner_id = p_user)    THEN 'lender'
           WHEN bool_or(t.borrower_id = p_user) THEN 'borrower'
         END
  FROM public.transactions t
  WHERE t.status = 'completed'
    AND auth.uid() IS NOT NULL
    AND auth.uid() <> p_user
    AND (
      (t.owner_id = auth.uid() AND t.borrower_id = p_user) OR
      (t.borrower_id = auth.uid() AND t.owner_id = p_user)
    );
$$;

GRANT EXECUTE ON FUNCTION public.manner_review_role(uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 평가 남기기 (다시 부르면 수정)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_manner_review(
  p_user uuid,
  p_q1 smallint,
  p_q2 smallint,
  p_q3 smallint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  -- 역할은 클라이언트가 보내는 대로 믿지 않고 거래 기록에서 직접 뽑는다.
  v_role := public.manner_review_role(p_user);
  IF v_role IS NULL THEN
    RAISE EXCEPTION '거래를 마친 상대만 평가할 수 있습니다';
  END IF;

  INSERT INTO public.user_manner_reviews (reviewer_id, reviewee_id, role, q1, q2, q3)
  VALUES (auth.uid(), p_user, v_role, p_q1, p_q2, p_q3)
  ON CONFLICT (reviewer_id, reviewee_id, role)
  DO UPDATE SET q1 = EXCLUDED.q1,
                q2 = EXCLUDED.q2,
                q3 = EXCLUDED.q3,
                updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_manner_review(uuid, smallint, smallint, smallint) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 내가 이 사람에게 남긴 평가 (수정할 때 폼을 채우려고)
-- 내가 쓴 것만 돌려주므로 익명이 깨지지 않는다.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_manner_review(p_user uuid)
RETURNS TABLE (role text, q1 smallint, q2 smallint, q3 smallint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.role, r.q1, r.q2, r.q3
  FROM public.user_manner_reviews r
  WHERE r.reviewer_id = auth.uid()
    AND r.reviewee_id = p_user
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_manner_review(uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 공개용 집계
--
-- total < 2 이거나 본인 자신이면 개수까지 0으로 눌러 내보낸다.
-- "숨김"을 클라이언트가 판단하게 두면 응답에는 값이 이미 실려 있어서,
-- 개발자도구만 열면 다 보인다. 그래서 서버에서 지우고 보낸다.
--
-- 2번 질문은 역할마다 뜻이 달라 따로 낸다. 섞어서 평균 내면
-- "책을 깨끗이 봤다"와 "책 상태가 설명 그대로였다"가 한 숫자로 뭉개진다.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_manner_summary(p_user uuid)
RETURNS TABLE (
  total            integer,
  avg_overall      numeric,
  avg_promise      numeric,
  avg_revisit      numeric,
  lender_count     integer,
  avg_as_described numeric,
  borrower_count   integer,
  avg_book_care    numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
BEGIN
  SELECT count(*) INTO v_total
  FROM public.user_manner_reviews r
  WHERE r.reviewee_id = p_user;

  -- 2개 미만이면 누가 줬는지 뻔하다. 본인에게도 보여주지 않는다.
  IF v_total < 2 OR auth.uid() = p_user THEN
    RETURN QUERY SELECT 0, NULL::numeric, NULL::numeric, NULL::numeric,
                        0, NULL::numeric, 0, NULL::numeric;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_total,
    round(avg((r.q1 + r.q2 + r.q3) / 3.0), 2),
    round(avg(r.q1), 2),
    round(avg(r.q3), 2),
    count(*) FILTER (WHERE r.role = 'lender')::integer,
    round(avg(r.q2) FILTER (WHERE r.role = 'lender'), 2),
    count(*) FILTER (WHERE r.role = 'borrower')::integer,
    round(avg(r.q2) FILTER (WHERE r.role = 'borrower'), 2)
  FROM public.user_manner_reviews r
  WHERE r.reviewee_id = p_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_manner_summary(uuid) TO authenticated;
