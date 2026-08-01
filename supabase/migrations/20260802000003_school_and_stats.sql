-- 학교 인증(사실 태그) + 완료 거래수 공개 지표.
--
-- 신뢰의 근거를 "플랫폼이 보증한다"가 아니라 "사실"로 준다:
--   · 학교 이메일로 가입/인증한 사람은 그 학교 태그를 단다(우리가 검증한 게 아니라, 그 이메일을 실제로 인증함).
--   · 완료한 거래 수를 그대로 보여준다(별점/매너온도 같은 주관 지표 대신 객관 카운트).

-- ── 1) profiles.school ────────────────────────────────────────
-- 이메일은 남에게 노출하지 않는다(프라이버시). 대신 도메인에서 유도한 '학교명'만 공개 컬럼으로 둔다.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school text;

-- 20260801000005에서 profiles는 '허용 컬럼만' SELECT GRANT 되어있다.
-- 새 컬럼은 명시적으로 열어주지 않으면 anon/authenticated가 못 읽는다(권한오류).
GRANT SELECT (school) ON public.profiles TO anon, authenticated;

-- ── 2) 이메일 도메인 → 싱가포르 대학/폴리 이름 ────────────────
CREATE OR REPLACE FUNCTION public.school_from_email(p_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d text := lower(split_part(coalesce(p_email, ''), '@', 2));
  r text;
BEGIN
  IF d = '' THEN RETURN NULL; END IF;
  SELECT s.name INTO r FROM (VALUES
    ('nus.edu.sg','NUS'), ('u.nus.edu','NUS'), ('nus.edu','NUS'),
    ('ntu.edu.sg','NTU'), ('e.ntu.edu.sg','NTU'),
    ('smu.edu.sg','SMU'), ('smu.edu','SMU'),
    ('sutd.edu.sg','SUTD'),
    ('singaporetech.edu.sg','SIT'),
    ('suss.edu.sg','SUSS'),
    ('uas.edu.sg','UAS'),
    ('lasalle.edu.sg','LASALLE'),
    ('nafa.edu.sg','NAFA'),
    ('np.edu.sg','NP'), ('sp.edu.sg','SP'), ('tp.edu.sg','TP'),
    ('nyp.edu.sg','NYP'), ('rp.edu.sg','RP'), ('ite.edu.sg','ITE')
  ) AS s(domain, name)
  WHERE d = s.domain OR d LIKE '%.' || s.domain
  ORDER BY length(s.domain) DESC   -- nus.edu.sg가 nus.edu보다 먼저 매칭되게
  LIMIT 1;
  RETURN r;
END;
$$;

-- ── 3) 본인 학교 이메일 인증(self-serve) ──────────────────────
-- 이미 Supabase가 인증한 가입 이메일을 재사용한다 → 별도 메일 발송 인프라 0.
-- 매치되면 학교명을 세팅, 아니면 NULL(해제). '우리가 검증'이 아니라 '그 이메일을 본인이 인증함'이 근거.
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
  UPDATE public.profiles SET school = v_school WHERE id = auth.uid();
  RETURN v_school;
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_school_email() TO authenticated;

-- ── 4) 기존 유저 백필 ─────────────────────────────────────────
UPDATE public.profiles p
SET school = public.school_from_email(u.email)
FROM auth.users u
WHERE u.id = p.id
  AND public.school_from_email(u.email) IS NOT NULL
  AND p.school IS DISTINCT FROM public.school_from_email(u.email);

-- ── 5) 공개 통계(완료 거래수) ─────────────────────────────────
-- transactions는 당사자만 볼 수 있다(RLS). 하지만 "완료 몇 건"이라는 집계 숫자는 신뢰 신호로 공개해도 된다.
-- 원자료는 안 나가고 카운트만 반환.
CREATE OR REPLACE FUNCTION public.get_user_public_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'completed_deals', (
      SELECT count(*)::int
      FROM public.transactions t
      WHERE t.status = 'completed'
        AND (t.owner_id = p_user_id OR t.borrower_id = p_user_id)
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_user_public_stats(uuid) TO anon, authenticated;
