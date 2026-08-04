-- (1) 위시리스트 컬럼 재확인 — "could not find the cover_url column ... schema cache" 대응.
--     ADD COLUMN IF NOT EXISTS 는 멱등이라 이미 있으면 아무 일도 안 한다.
ALTER TABLE public.wishlists ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.wishlists ADD COLUMN IF NOT EXISTS desired_mode text NOT NULL DEFAULT 'any';

-- (2) 같은 학교 이메일은 한 계정만 인증 가능 — 부분 유니크 인덱스(비어있는 값은 제외).
--     계정(=profiles row) 삭제 시 값이 사라지므로 자동 리셋된다.
--     lower()로 대소문자 무시(엣지함수도 소문자로 저장).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_school_email_unique
  ON public.profiles (lower(school_email))
  WHERE school_email IS NOT NULL;

-- (3) PostgREST 스키마 캐시 강제 리로드 — 새 컬럼이 API에 즉시 보이게 한다.
NOTIFY pgrst, 'reload schema';
