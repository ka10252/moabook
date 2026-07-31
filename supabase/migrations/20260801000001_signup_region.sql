-- 회원가입에 "싱가포르 지역(옵셔널)"을 추가한다.
--
-- 하이퍼로컬 책공유라 같은 동네/권역 여부가 매칭·큐레이션에 중요하다.
-- 국가(country)와 동일하게, 세션이 없는 이메일 인증 시점에도 안전하게 저장되도록
-- 가입 메타데이터로 받아 프로필 생성 트리거(handle_new_user)가 함께 넣는다.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS region text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, country, region)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'User_' || LEFT(NEW.id::text, 8)),
    NULLIF(NEW.raw_user_meta_data->>'country', ''),
    NULLIF(NEW.raw_user_meta_data->>'region', '')
  );
  RETURN NEW;
END;
$$;

-- 이미 가입했지만 메타데이터에 지역이 있는 경우 메운다(향후 재실행에도 안전).
UPDATE public.profiles p
SET region = NULLIF(u.raw_user_meta_data->>'region', '')
FROM auth.users u
WHERE u.id = p.id
  AND p.region IS NULL
  AND NULLIF(u.raw_user_meta_data->>'region', '') IS NOT NULL;
