-- communities.pin_hash 읽기 권한 회수 (telegram_link_code와 같은 문제).
--
-- 20260801000002 line169의 `REVOKE SELECT (pin_hash)`는 테이블 레벨 SELECT 권한이 있어
-- 무효(Postgres 규칙)였다 → pin_hash(커뮤니티 PIN 해시)가 계속 읽혔다(bcrypt라 심각도는 낮음).
--
-- 올바른 방법: 테이블 SELECT를 회수하고, pin_hash를 뺀 '나머지 전 컬럼'을 다시 GRANT.
-- 컬럼이 여러 마이그에 흩어져 있고 generated types도 stale이라, 하드코딩 대신
-- information_schema로 현재 컬럼을 동적으로 읽어 pin_hash만 제외하고 GRANT 한다(누락 방지).
--
-- 안전성:
--   · 앱 코드는 pin_hash를 읽지 않는다(작성=insert, 검증=verify_community_pin RPC, 목록=communities_public 뷰).
--   · base communities select는 전부 명시 컬럼(≠pin_hash) — select('*') 없음. → 안 깨짐.
--   · communities_public 뷰/PIN RPC는 SECURITY DEFINER라 영향 없음.

DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'communities'
    AND column_name <> 'pin_hash';

  EXECUTE 'REVOKE SELECT ON public.communities FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.communities TO anon, authenticated', cols);
END $$;

-- 롤백: GRANT SELECT (pin_hash) ON public.communities TO anon, authenticated;
