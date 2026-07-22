-- 행동 로그 90일 자동 삭제.
--
-- events는 user_id로 개인과 연결되므로 개인정보다. 무기한 쌓으면 최소보관 원칙에 어긋난다.
-- 퍼널·리텐션 분석에 90일이면 충분하다. 더 긴 추세는 개인 식별 없는 요약으로 따로 남긴다.
--
-- ⚠️ 이 파일은 "매일 90일 지난 로그를 지우는 예약 작업"을 만든다. 데이터를 삭제한다.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.purge_old_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.events
  WHERE created_at < now() - interval '90 days';
END;
$$;

-- 매일 새벽 3시(싱가포르) = UTC 19:00. 트래픽 적은 시간에.
SELECT cron.unschedule('purge-old-events')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-old-events');

SELECT cron.schedule(
  'purge-old-events',
  '0 19 * * *',
  $$ SELECT public.purge_old_events(); $$
);
