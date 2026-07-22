-- push_subscriptions — 잠금화면 푸시를 보낼 주소(엔드포인트)를 유저별로 보관한다.
--
-- 이 테이블은 원래 SQL Editor에서 손으로 만들어서 migrations 장부에 없었다.
-- DB를 새로 세우면 푸시만 조용히 죽는 상태였다 → 여기서 장부에 편입한다.
-- 이미 있는 DB에서 다시 돌려도 안전하도록 전부 멱등하게 쓴다.
--
-- 주의: notifications → 푸시 발송 트리거(trg_notifications_push)는 공유 비밀키를 담고 있어
--       이 파일에 넣지 않는다. 그 SQL은 저장소 밖에서 관리한다.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     text NOT NULL,
  subscription jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- 같은 기기를 두 번 저장하면 푸시가 두 번 간다
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ── 테이블 권한 ────────────────────────────────────────────────
-- RLS 정책은 "어떤 행을 볼 수 있나"만 정한다. 테이블에 손을 댈 수 있는지는 GRANT가 정한다.
-- GRANT가 없으면 정책이 아무리 완벽해도 42501(permission denied)로 전부 막힌다.
-- 실제로 이것 때문에 알림 켜기가 즉시 실패했다.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

-- send-push Edge Function이 이 역할로 접속한다. 구독 주소를 읽어야 푸시를 보낼 수 있고,
-- 죽은 구독(404/410)을 지워야 테이블이 쓰레기로 차지 않는다.
-- 이게 없으면 함수는 조용히 "보낼 대상 0명"이라고 판단하고 끝난다 — 에러도 안 난다.
GRANT SELECT, DELETE ON public.push_subscriptions TO service_role;

-- anon은 줄 이유가 없다. 로그인하지 않은 사람에게 보낼 푸시가 없다.

-- ── 행 단위 접근 ───────────────────────────────────────────────
-- 남의 구독 주소가 새면 그 사람에게 임의의 푸시를 보낼 수 있다. 철저히 본인 것만.
DROP POLICY IF EXISTS "own subscriptions - select" ON public.push_subscriptions;
CREATE POLICY "own subscriptions - select" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own subscriptions - insert" ON public.push_subscriptions;
CREATE POLICY "own subscriptions - insert" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own subscriptions - update" ON public.push_subscriptions;
CREATE POLICY "own subscriptions - update" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own subscriptions - delete" ON public.push_subscriptions;
CREATE POLICY "own subscriptions - delete" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 스키마를 직접 바꿨으니 REST 계층에 다시 읽으라고 알린다
NOTIFY pgrst, 'reload schema';
