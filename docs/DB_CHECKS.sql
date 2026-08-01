-- moabook DB 상태 점검 (Supabase SQL Editor에 통째로 붙여넣고 실행)
-- ok 컬럼이 전부 true 면 정상. false 가 있으면 아래 "조치" 참고.

select '1. 웹푸시 트리거 (notifications 테이블 push 트리거)' as item,
  exists(
    select 1 from pg_trigger
    where tgrelid = 'public.notifications'::regclass
      and not tgisinternal
      and tgname ilike '%push%'
  ) as ok
union all
select '2. notifications realtime publication 등록 (0731_3)',
  exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  )
union all
select '3. notifications REPLICA IDENTITY FULL (0731_3)',
  coalesce((select relreplident = 'f' from pg_class
            where relname = 'notifications' and relnamespace = 'public'::regnamespace), false)
union all
select '4. 반납 리마인더 COALESCE(return_date,end_date) 수정 (0731_4)',
  coalesce((select prosrc ilike '%coalesce(tx.return_date%'
            from pg_proc where proname = 'notify_due_returns' limit 1), false)
union all
select '5. member_count is_banned 트리거 (0731_5)',
  exists(
    select 1 from pg_trigger
    where tgname = 'update_member_count'
      and pg_get_triggerdef(oid) ilike '%is_banned%'
  )
union all
select '6. safe_uuid 배포됨 (0802_4)',
  exists(select 1 from pg_proc where proname = 'safe_uuid')
order by item;

-- ── 조치 ────────────────────────────────────────────────────
-- 1 false: 웹푸시 트리거가 없음 = 잠금화면 푸시 안 감. 이 트리거는 레포 밖(Supabase에서 직접 생성)
--          이라 자동 복구 불가 → 알려주면 send-push 엣지함수 호출 트리거를 재구성해 드림.
-- 2 false: SQL Editor에서  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
-- 3 false: ALTER TABLE public.notifications REPLICA IDENTITY FULL;
-- 4 false: 마이그 20260731000004 미실행 → 실행.
-- 5 false: 마이그 20260731000005 미실행 → 실행.
-- 6 false: 마이그 20260802000004 미실행 → 실행.
