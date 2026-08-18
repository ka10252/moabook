-- 책이 어느 커뮤니티 책장에 보일지를 따로 관리한다.
--
-- 왜 필요한가
--   지금은 `books.community_id` 하나뿐이라 두 가지를 못 한다.
--     · 커뮤니티 전용 책을 **여러 커뮤니티**에 올리기
--     · 전체공개 책을 **특정 커뮤니티에서만 숨기기**
--   특히 후자가 문제였다. 전체공개를 고르는 순간 내가 속한 **모든** 커뮤니티에
--   자동으로 올라가고, 빼는 방법이 없었다.
--   (회사 동료 커뮤니티에는 읽는 책을 알리고 싶지 않은 사람이 있다)
--
-- 규칙 — 한 표로 두 경우를 다룬다
--   전체공개 책(is_public = true)   : visible = false 행이 있으면 **그 커뮤니티에서 숨김**
--   커뮤니티 전용 책(is_public=false): visible = true  행이 있는 커뮤니티에만 **공개**
--
--   즉 "책 B가 커뮤니티 C 책장에 보이는가" =
--     ( B.is_public AND NOT EXISTS(B,C,visible=false) )
--     OR ( NOT B.is_public AND EXISTS(B,C,visible=true) )
--
-- ⚠️ 왜 '포함 목록'이 아니라 '제외 목록'인가(전체공개의 경우)
--    포함 목록으로 하면 등록 시점의 커뮤니티 집합이 그대로 굳는다. 나중에 새 커뮤니티에
--    가입해도 이전에 올린 공개책이 그 책장에 안 나타난다. 제외 목록이면 자동으로 나타난다 —
--    지금 동작과 같고, 유저의 기대("숨기기는 예외다")와도 맞는다.

CREATE TABLE IF NOT EXISTS public.book_community_visibility (
  book_id      uuid NOT NULL REFERENCES public.books(id)       ON DELETE CASCADE,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  -- true  = 이 커뮤니티에 공개 (커뮤니티 전용 책이 쓰는 값)
  -- false = 이 커뮤니티에서 숨김 (전체공개 책이 쓰는 값)
  visible      boolean NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (book_id, community_id)
);

CREATE INDEX IF NOT EXISTS bcv_community_idx ON public.book_community_visibility (community_id, visible);

ALTER TABLE public.book_community_visibility ENABLE ROW LEVEL SECURITY;

-- ⚠️ RLS 정책만으로는 부족하다. 테이블 GRANT가 따로 필요하다 —
--    없으면 정책이 허용해도 42501(권한 없음)로 막힌다.
--    (이걸 빠뜨려서 20260820000002 로 따로 넣었다)
GRANT SELECT ON public.book_community_visibility TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.book_community_visibility TO authenticated;

-- 읽기: 누구나. 이 표만으로는 아무 정보도 새지 않는다 —
-- 책 자체의 접근 권한은 books 의 RLS가 이미 정한다.
CREATE POLICY "book visibility readable"
  ON public.book_community_visibility FOR SELECT
  USING (true);

-- 쓰기: 그 책의 주인만.
CREATE POLICY "owner manages book visibility"
  ON public.book_community_visibility FOR ALL
  USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_id AND b.owner_id = auth.uid()));

-- 기존 데이터 이전 — 커뮤니티 전용 책은 그 커뮤니티에 공개된 것으로 옮긴다.
-- 전체공개 책은 옮길 게 없다(숨긴 곳이 없으므로 행도 없다) → 지금과 동작이 같다.
INSERT INTO public.book_community_visibility (book_id, community_id, visible)
SELECT b.id, b.community_id, true
FROM public.books b
WHERE b.community_id IS NOT NULL
  AND b.is_public = false
ON CONFLICT (book_id, community_id) DO NOTHING;
