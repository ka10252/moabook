-- ============================================================
-- 신고(reports) + 차단(blocked_users)
-- 실유저 대상 서비스의 최소 안전장치. 스토어 심사 요건이기도 하다.
-- ============================================================

CREATE TYPE public.report_target_type AS ENUM ('book', 'message', 'post', 'comment', 'user');
CREATE TYPE public.report_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');

-- ============================================
-- REPORTS
-- ============================================
CREATE TABLE public.reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_type      report_target_type NOT NULL,
  target_id        UUID,
  reason           TEXT NOT NULL,
  detail           TEXT,
  -- 신고 시점의 콘텐츠 스냅샷. 원본이 삭제돼도 관리자가 판단할 수 있어야 한다.
  context          TEXT,
  status           report_status NOT NULL DEFAULT 'pending',
  admin_note       TEXT,
  resolved_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 같은 대상을 중복 신고하지 못하게 (사유가 달라도 1인 1건)
CREATE UNIQUE INDEX reports_unique_per_reporter
  ON public.reports (reporter_id, target_type, target_id)
  WHERE target_id IS NOT NULL;

CREATE INDEX reports_status_created_idx ON public.reports (status, created_at DESC);
CREATE INDEX reports_reported_user_idx  ON public.reports (reported_user_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can file reports"
ON public.reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
ON public.reports FOR SELECT TO authenticated
USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports"
ON public.reports FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Admins can update reports"
ON public.reports FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- ============================================
-- BLOCKED USERS
-- ============================================
CREATE TABLE public.blocked_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX blocked_users_blocker_idx ON public.blocked_users (blocker_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own block list"
ON public.blocked_users FOR SELECT TO authenticated
USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others"
ON public.blocked_users FOR INSERT TO authenticated
WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock"
ON public.blocked_users FOR DELETE TO authenticated
USING (auth.uid() = blocker_id);

-- ============================================
-- 차단 판정 함수 (양방향)
-- A가 B를 차단했든 B가 A를 차단했든 둘 사이는 막힌다.
-- ============================================
CREATE OR REPLACE FUNCTION public.is_blocked_between(_a UUID, _b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id = _a AND blocked_id = _b)
       OR (blocker_id = _b AND blocked_id = _a)
  )
$$;

-- ============================================
-- 차단 반영은 전부 서버(RLS)에서 한다.
--
-- 클라이언트 필터링만으로는 두 가지가 불가능하다:
--   1) "나를 차단한 사람"은 내가 알 수 없다 (blocked_users는 blocker 본인만 조회 가능)
--   2) 네트워크 요청을 직접 날리면 우회된다
-- is_blocked_between()은 SECURITY DEFINER라 RLS를 우회해 양방향 판정이 가능하다.
-- ============================================

-- (1) 차단된 상대에게는 메시지를 보낼 수 없다
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;

CREATE POLICY "Participants can send messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND public.is_conversation_participant(auth.uid(), conversation_id)
  AND NOT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = conversation_id
      AND public.is_blocked_between(c.participant_1, c.participant_2)
  )
);

-- (2) 차단한(또는 나를 차단한) 사람의 책은 목록에서 보이지 않는다
DROP POLICY IF EXISTS "Public books are viewable by everyone" ON public.books;

CREATE POLICY "Public books are viewable by everyone"
ON public.books FOR SELECT
USING (
  (
    is_public = true
    OR auth.uid() = owner_id
    OR (community_id IS NOT NULL AND public.is_community_member(auth.uid(), community_id))
  )
  -- 내 책은 항상 보인다. 차단 판정은 남의 책에만 적용.
  AND (
    auth.uid() IS NULL
    OR auth.uid() = owner_id
    OR NOT public.is_blocked_between(auth.uid(), owner_id)
  )
);

-- (3) 차단된 상대와의 대화는 목록에서 사라진다
DROP POLICY IF EXISTS "Participants can view their conversations" ON public.conversations;

CREATE POLICY "Participants can view their conversations"
ON public.conversations FOR SELECT TO authenticated
USING (
  (auth.uid() = participant_1 OR auth.uid() = participant_2)
  AND NOT public.is_blocked_between(participant_1, participant_2)
);
