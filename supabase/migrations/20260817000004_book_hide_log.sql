-- 숨김 히스토리.
--
-- books.hidden_reason은 "지금 왜 숨겨져 있나"만 알려주고, 해제하면 지워진다.
-- 나중에 "이 책 예전에 왜 숨겼더라"를 확인하려면 별도 기록이 필요하다.
-- 같은 책이 반복해서 숨겨지는지도 여기서만 보인다.

CREATE TABLE IF NOT EXISTS public.book_hide_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  -- 책이 지워져도 기록은 남기고 싶지만, 책 상세를 못 보여주므로 제목을 박아둔다.
  book_title text,
  action text NOT NULL CHECK (action IN ('hide', 'unhide')),
  reason text,
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_hide_log_created ON public.book_hide_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_book_hide_log_book ON public.book_hide_log(book_id);

ALTER TABLE public.book_hide_log ENABLE ROW LEVEL SECURITY;

-- 관리자만 본다. 일반 유저에게 "누가 무엇을 왜 숨겼는지"를 보여줄 이유가 없다.
DROP POLICY IF EXISTS "book_hide_log_admin_select" ON public.book_hide_log;
CREATE POLICY "book_hide_log_admin_select"
  ON public.book_hide_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.book_hide_log TO authenticated;

-- 숨기기/해제 RPC가 기록도 함께 남기도록 교체한다.
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
DECLARE
  v_title text;
  v_reason text := NULLIF(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT title INTO v_title FROM public.books WHERE id = p_book_id;

  UPDATE public.books
  SET hidden_at     = CASE WHEN p_hidden THEN now() ELSE NULL END,
      hidden_reason = CASE WHEN p_hidden THEN v_reason ELSE NULL END,
      hidden_by     = CASE WHEN p_hidden THEN auth.uid() ELSE NULL END
  WHERE id = p_book_id;

  INSERT INTO public.book_hide_log (book_id, book_title, action, reason, admin_id)
  VALUES (p_book_id, v_title, CASE WHEN p_hidden THEN 'hide' ELSE 'unhide' END, v_reason, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_book_hidden(uuid, boolean, text) TO authenticated;
