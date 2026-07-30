-- 텔레그램 알림 연동
-- telegram_chat_id: 연동된 텔레그램 chat id (여기로 메시지 발송)
-- telegram_opt_in: 텔레그램 알림 수신 동의
-- telegram_link_code: 앱에서 "연동하기" 시 발급하는 일회용 코드. 봇 /start 로 넘어와 chat_id를 매칭한다.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id  text,
  ADD COLUMN IF NOT EXISTS telegram_opt_in   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_link_code text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_link_code_idx
  ON public.profiles (telegram_link_code) WHERE telegram_link_code IS NOT NULL;
