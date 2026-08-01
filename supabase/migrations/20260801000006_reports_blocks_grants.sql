-- reports/blocked_users는 RLS 정책만 있고 테이블 GRANT가 없어 authenticated가
-- INSERT 시 "permission denied for table"(42501)로 실패했다(신고·차단 동작 안 함).
-- RLS는 "행 조건"만 정하고, 기본 접근 권한(GRANT)이 따로 있어야 한다.
GRANT SELECT, INSERT, UPDATE ON public.reports        TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.blocked_users  TO authenticated;
