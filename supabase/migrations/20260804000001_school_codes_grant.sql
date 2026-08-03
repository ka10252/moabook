-- 학교 인증 코드 테이블에 service_role 접근 권한 부여.
--
-- 20260802000009에서 school_email_codes를 RLS만 켜고 만들면서 "service_role은 RLS 우회라 GRANT 불필요"라고
-- 적었는데, 이는 틀렸다: service_role은 RLS는 우회하지만 '테이블 GRANT'는 여전히 필요하다.
-- 그래서 school-verify 엣지함수(service_role)가 upsert할 때 "permission denied for table" (42501)로 실패했다.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_email_codes TO service_role;
