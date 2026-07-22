-- 가입 시 고른 국가가 프로필에 저장되지 않던 문제.
--
-- 프론트는 가입 직후 profiles를 UPDATE 해서 country를 넣으려 했다.
-- 그런데 이메일 인증이 켜져 있으면 그 시점엔 세션이 없다 → auth.uid()가 null →
-- RLS가 그 UPDATE를 거부한다. 에러는 아무도 확인하지 않았고, 국가는 전부 비어 있었다.
-- 싱가포르 거주자만 받는 서비스인데 누가 어느 나라 사람인지 기록이 없는 상태였다.
--
-- 이제 국가를 회원가입 메타데이터로 받아, 프로필을 만드는 트리거가 함께 넣는다.
-- 세션이 필요 없으므로(SECURITY DEFINER) RLS에 막히지 않는다.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, country)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'User_' || LEFT(NEW.id::text, 8)),
    NULLIF(NEW.raw_user_meta_data->>'country', '')
  );
  RETURN NEW;
END;
$$;

-- 이미 가입한 사람들 중 메타데이터에는 국가가 있는데 프로필에는 빠진 경우를 메운다.
-- (지금은 해당자가 없지만, 이 마이그레이션 이후 가입자에게 재실행돼도 안전하다)
UPDATE public.profiles p
SET country = NULLIF(u.raw_user_meta_data->>'country', '')
FROM auth.users u
WHERE u.id = p.id
  AND p.country IS NULL
  AND NULLIF(u.raw_user_meta_data->>'country', '') IS NOT NULL;
