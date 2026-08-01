-- 신고(reports)·차단(blocked_users) 복구 — 원본 20260713000001이 프로덕션에 실행되지 않아
-- 두 테이블이 없고, 신고/차단 기능이 런타임 에러로 죽어 있었다(실유저 안전장치 + 스토어 요건).
-- 이 파일은 부분 실행/재실행에도 안전하도록 전부 IF NOT EXISTS / DROP-IF-EXISTS 가드를 둔다.
-- messages/books/conversations 정책은 현재 정책명과 정확히 일치해 깔끔히 교체된다(중복 없음).

-- ── ENUM (없을 때만 생성) ─────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_target_type') THEN
    CREATE TYPE public.report_target_type AS ENUM ('book', 'message', 'post', 'comment', 'user');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE public.report_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');
  END IF;
END $$;

-- ── REPORTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_type      report_target_type NOT NULL,
  target_id        UUID,
  reason           TEXT NOT NULL,
  detail           TEXT,
  context          TEXT,
  status           report_status NOT NULL DEFAULT 'pending',
  admin_note       TEXT,
  resolved_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_per_reporter
  ON public.reports (reporter_id, target_type, target_id) WHERE target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reports_status_created_idx ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_reported_user_idx  ON public.reports (reported_user_id);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can file reports" ON public.reports;
CREATE POLICY "Users can file reports" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Users can view their own reports" ON public.reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
CREATE POLICY "Admins can view all reports" ON public.reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports" ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- ── BLOCKED USERS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS blocked_users_blocker_idx ON public.blocked_users (blocker_id);
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own block list" ON public.blocked_users;
CREATE POLICY "Users can view their own block list" ON public.blocked_users FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "Users can block others" ON public.blocked_users;
CREATE POLICY "Users can block others" ON public.blocked_users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "Users can unblock" ON public.blocked_users;
CREATE POLICY "Users can unblock" ON public.blocked_users FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);

-- ── 양방향 차단 판정 (SECURITY DEFINER로 RLS 우회 판정) ──
CREATE OR REPLACE FUNCTION public.is_blocked_between(_a UUID, _b UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
  )
$$;

-- ── 차단 반영(핵심 RLS) — 정책명 일치로 깔끔히 교체 ──
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages" ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND public.is_conversation_participant(auth.uid(), conversation_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND public.is_blocked_between(c.participant_1, c.participant_2)
  )
);

DROP POLICY IF EXISTS "Public books are viewable by everyone" ON public.books;
CREATE POLICY "Public books are viewable by everyone" ON public.books FOR SELECT
USING (
  (is_public = true OR auth.uid() = owner_id
   OR (community_id IS NOT NULL AND public.is_community_member(auth.uid(), community_id)))
  AND (auth.uid() IS NULL OR auth.uid() = owner_id OR NOT public.is_blocked_between(auth.uid(), owner_id))
);

DROP POLICY IF EXISTS "Participants can view their conversations" ON public.conversations;
CREATE POLICY "Participants can view their conversations" ON public.conversations FOR SELECT TO authenticated
USING (
  (auth.uid() = participant_1 OR auth.uid() = participant_2)
  AND NOT public.is_blocked_between(participant_1, participant_2)
);
