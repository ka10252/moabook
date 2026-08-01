-- 🔴 보안: profiles의 telegram_link_code(텔레그램 연동 비밀코드)가 공개 SELECT로 노출되고 있었다.
-- 이 코드를 읽으면 t.me/bot?start=<코드> 로 피해자 계정의 알림을 공격자 텔레그램에 연결(하이재킹) 가능.
-- 클라이언트는 이 컬럼을 UPDATE(쓰기)만 하고 읽지 않는다. 봇(Edge Function)은 service_role이라 영향 없음.
-- → anon/authenticated 의 이 컬럼 SELECT 권한만 회수한다. (다른 컬럼 읽기는 그대로)
REVOKE SELECT (telegram_link_code) ON public.profiles FROM anon, authenticated;

-- 주: 이 회수 이후 profiles를 select('*') 하면 권한오류가 나므로, 클라 코드의 '*'는 명시 컬럼으로 바꿨다.
