-- 프로필 프라이버시 (B: 컬럼 잠그기). ⚠️ 반드시 아래를 먼저 끝낸 뒤 실행:
--   ① 20260802000005(A) 실행됨   ② 프론트 재배포(남의 프로필=profiles_public,
--      본인 비공개=get_my_private_profile, 텔레그램=am_i_telegram_linked, 관리자=admin_list_users/admin_get_user)
--   ③ 로그인/관리자 화면에서 프로필·텔레그램·관리자 목록 정상 확인
--
-- 이 파일은 base profiles에서 gender/age/telegram_chat_id의 SELECT 권한만 회수한다.
-- 이후 이 세 컬럼은 anon/authenticated가 base 테이블에서 직접 못 읽는다.
--   · 남이 보는 gender/age → profiles_public 뷰(=_public일 때만)
--   · 본인/관리자 → RPC
--   · 임베드(nickname/avatar/district)는 영향 없음
--
-- 되돌리려면(롤백):
--   GRANT SELECT (gender, age, telegram_chat_id) ON public.profiles TO anon, authenticated;

REVOKE SELECT (gender, age, telegram_chat_id) ON public.profiles FROM anon, authenticated;
