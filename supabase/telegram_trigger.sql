-- 텔레그램 발송 트리거 — SQL Editor에서 실행 (함수 URL·시크릿 포함하므로 레포 마이그레이션이 아닌 여기서 관리)
--
-- 사전 준비:
--   1) supabase functions deploy telegram-notify  (아래 안내)
--   2) 아래 https://venrajnufandslcbehkz.supabase.co/functions/v1/telegram-notify, __TELEGRAM_TRIGGER_SECRET__ 를 실제 값으로 치환
--        - https://venrajnufandslcbehkz.supabase.co/functions/v1/telegram-notify            예) https://<project-ref>.supabase.co/functions/v1/telegram-notify
--        - __TELEGRAM_TRIGGER_SECRET__ Edge Function secret 과 동일한 임의 문자열
--   3) pg_net 확장 필요:  create extension if not exists pg_net;

create extension if not exists pg_net;

create or replace function public.notify_telegram_tier1()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'net', 'extensions'   -- ⚠️ pg_net(net.http_post)가 내부 참조를 못 찾아 OOM 나던 원인. 푸시 트리거와 동일하게 지정.
as $$
begin
  -- 행동 필요 + 시간 민감한 Tier1 알림만 텔레그램으로 (나머지는 앱/푸시로만)
  if NEW.type in ('book_request','request_accepted','return_due','return_overdue','waitlist_available') then
    -- ⚠️ 텔레그램 발송(http 호출)이 실패해도 메시지/알림 저장은 절대 막지 않는다.
    --    감싸지 않으면 net.http_post 오류가 부모 INSERT를 통째로 실패시킨다(대여요청·수락 등 깨짐).
    begin
      perform net.http_post(
        url     := 'https://venrajnufandslcbehkz.supabase.co/functions/v1/telegram-notify',
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
    exception when others then
      raise warning 'telegram notify skipped: %', sqlerrm;
    end;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notifications_telegram on public.notifications;
create trigger trg_notifications_telegram
  after insert on public.notifications
  for each row execute function public.notify_telegram_tier1();
