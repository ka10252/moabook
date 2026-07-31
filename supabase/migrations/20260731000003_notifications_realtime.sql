-- 인앱 실시간 알림: notifications 테이블이 realtime publication에 빠져 있어
-- 새 알림(대여 수락·요청 등)이 새로고침 전엔 벨에 안 뜨던 문제를 고친다.
-- (messages·site_announcements만 등록돼 있었음)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- UPDATE/DELETE 이벤트가 user_id 필터로도 매칭되고 old 레코드가 실려오도록
-- (읽음 처리·삭제의 크로스-기기 동기화용). INSERT는 이것 없이도 동작.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
