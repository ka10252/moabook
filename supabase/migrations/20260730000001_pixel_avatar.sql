-- 픽셀 캐릭터 커스터마이징 저장
-- 예: { "body":"05", "eyes":"01", "hairShape":"03", "hairColor":"02",
--       "outfitStyle":"01", "outfitColor":"03" }
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pixel_avatar jsonb;
