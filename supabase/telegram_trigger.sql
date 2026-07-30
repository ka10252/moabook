-- 텔레그램 발송 트리거 — SQL Editor에서 실행 (함수 URL·시크릿 포함하므로 레포 마이그레이션이 아닌 여기서 관리)
--
-- 사전 준비:
--   1) supabase functions deploy telegram-notify  (아래 안내)
--   2) 아래 __FUNCTION_URL__, __TELEGRAM_TRIGGER_SECRET__ 를 실제 값으로 치환
--        - __FUNCTION_URL__            예) https://<project-ref>.supabase.co/functions/v1/telegram-notify
--        - __TELEGRAM_TRIGGER_SECRET__ Edge Function secret 과 동일한 임의 문자열
--   3) pg_net 확장 필요:  create extension if not exists pg_net;

create extension if not exists pg_net;

create or replace function public.notify_telegram_tier1()
returns trigger
language plpgsql
security definer
as $$
begin
  -- 행동 필요 + 시간 민감한 Tier1 알림만 텔레그램으로 (나머지는 앱/푸시로만)
  if NEW.type in ('book_request','request_accepted','return_due','return_overdue','waitlist_available') then
    perform net.http_post(
      url     := '__FUNCTION_URL__',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-tg-secret', '__TELEGRAM_TRIGGER_SECRET__'
                 ),
      body    := jsonb_build_object(
                   'user_id', NEW.user_id,
                   'type',    NEW.type,
                   'title',   NEW.title,
                   'body',    NEW.body,
                   'data',    NEW.data
                 )
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notifications_telegram on public.notifications;
create trigger trg_notifications_telegram
  after insert on public.notifications
  for each row execute function public.notify_telegram_tier1();
