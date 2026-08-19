-- 푸시 채널 구분 (web | ios)
--
-- 지금까지 `push_subscriptions` 는 웹 푸시(VAPID) 구독만 담았다. 그 구독은 브라우저가
-- 주는 `endpoint` + 암호화 키 뭉치라, iOS 앱이 주는 **APNs 기기 토큰**과 생김새가 전혀 다르다.
-- 한 표에 섞어 두려면 "이 줄이 어느 채널인지"를 알아야 한다 — 안 그러면 발송할 때
-- APNs 토큰을 web-push 로 보내려다 조용히 실패한다.
--
--   web : subscription = { endpoint, keys: {...} }  · endpoint = 브라우저가 준 URL
--   ios : subscription = { token }                  · endpoint = APNs 기기 토큰(고유하므로 그대로 씀)

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'web';

-- 기존 줄은 전부 웹이다(기본값이 이미 그렇지만 뜻을 분명히 해둔다).
COMMENT ON COLUMN public.push_subscriptions.channel IS
  '푸시 채널 — web(브라우저 VAPID) | ios(APNs 기기 토큰)';

-- 발송할 때 user_id + channel 로 고른다.
CREATE INDEX IF NOT EXISTS push_subscriptions_user_channel_idx
  ON public.push_subscriptions (user_id, channel);

-- 값이 둘뿐이라 오타로 조용히 새는 걸 막는다.
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_channel_check;
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_channel_check CHECK (channel IN ('web', 'ios'));
