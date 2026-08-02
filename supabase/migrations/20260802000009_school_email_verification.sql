-- 학교 이메일 인증(가입 이메일과 분리). 코드 발송은 엣지함수 school-verify가 담당.
--
-- 흐름:
--   · 가입 이메일이 학교 도메인이면 → verify_school_email()로 바로 인증(코드 불필요).
--   · 그 외(gmail 등)면 → 학교 이메일 입력 → 코드 메일 수신 → 확인 → 인증.
-- school(학교명, 공개)·school_email(인증 주소, 비공개)·school_verified_at(시각) 추적.

-- ── 컬럼 ──────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_verified_at timestamptz;
-- school_email/verified_at은 PII → 공개 GRANT 하지 않는다(관리자·service_role만).
-- 공개되는 건 school(학교명)뿐 — 이미 20260802000003에서 GRANT됨.

-- ── 인증 코드 임시 저장(유저당 1개) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.school_email_codes (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  code       text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.school_email_codes ENABLE ROW LEVEL SECURITY;
-- 클라 접근 전면 차단 — 오직 엣지함수(service_role)만 읽고 쓴다. (정책 없음 = 접근 불가)
-- service_role은 RLS를 우회하므로 별도 GRANT/정책 불필요.

-- ── 가입 이메일 자동 인증 (코드 불필요) ───────────────────────
-- 기존(20260802000003)은 매치 안 되면 school을 NULL로 밀어버려, OTP로 인증한 값을 지울 수 있었다.
-- → 매치될 때만 세팅하고, 절대 지우지 않도록 고친다. school_email/verified_at도 함께 채운다.
CREATE OR REPLACE FUNCTION public.verify_school_email()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email  text;
  v_school text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  v_school := public.school_from_email(v_email);
  IF v_school IS NOT NULL THEN
    UPDATE public.profiles
    SET school = v_school,
        school_email = v_email,
        school_verified_at = coalesce(school_verified_at, now())
    WHERE id = auth.uid();
  END IF;
  RETURN v_school;   -- NULL이면 가입 이메일이 학교 이메일이 아님(=OTP 필요)
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_school_email() TO authenticated;
