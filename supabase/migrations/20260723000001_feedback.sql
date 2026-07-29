-- 의견 보내기 (건의함)
--
-- 유저가 프로필에서 남기는 건의·버그·아이디어를 모은다.
-- events(행동 로그)와 달리 이건 사람이 직접 쓴 글이라 별도 테이블로 둔다.

CREATE TABLE IF NOT EXISTS public.feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category   text,                       -- 'bug' | 'idea' | 'etc' (안 고르면 null)
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 관리자가 최신순으로 읽는다
CREATE INDEX IF NOT EXISTS feedback_created_idx ON public.feedback (created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- ── 권한 ───────────────────────────────────────────────────
-- 프론트는 "쓰기"만. 남의 의견을 읽거나 고칠 수 없다. 조회는 관리자(service_role)만.
GRANT INSERT ON public.feedback TO authenticated;
GRANT SELECT ON public.feedback TO service_role;

-- 자기 자신 이름으로만 남길 수 있다 (남의 것으로 위조 차단)
DROP POLICY IF EXISTS "feedback - insert own" ON public.feedback;
CREATE POLICY "feedback - insert own" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.feedback IS
  '유저 의견/건의. 프론트는 INSERT만, 조회는 service_role로.';
