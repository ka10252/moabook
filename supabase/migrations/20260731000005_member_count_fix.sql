-- 커뮤니티 member_count 부정확 수정.
-- 원인: 밴은 community_members를 UPDATE(is_banned=true)하는데, 기존 트리거는 INSERT/DELETE만
--       처리해 밴된 멤버가 계속 카운트에 잡혀 있었다(목록엔 안 보이는데 수는 부풀려짐).
-- 수정: is_banned 전이(밴/해제)도 반영 + 기존 drift 일괄 보정.

CREATE OR REPLACE FUNCTION public.update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_banned, false) = false THEN
      UPDATE public.communities SET member_count = member_count + 1 WHERE id = NEW.community_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- 이미 밴돼 카운트에서 빠진 멤버를 삭제할 땐 또 빼지 않는다
    IF COALESCE(OLD.is_banned, false) = false THEN
      UPDATE public.communities SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.community_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.is_banned, false) = false AND COALESCE(NEW.is_banned, false) = true THEN
      UPDATE public.communities SET member_count = GREATEST(0, member_count - 1) WHERE id = NEW.community_id;
    ELSIF COALESCE(OLD.is_banned, false) = true AND COALESCE(NEW.is_banned, false) = false THEN
      UPDATE public.communities SET member_count = member_count + 1 WHERE id = NEW.community_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_member_count ON public.community_members;
CREATE TRIGGER update_member_count
AFTER INSERT OR DELETE OR UPDATE OF is_banned ON public.community_members
FOR EACH ROW
EXECUTE FUNCTION public.update_community_member_count();

-- 기존 drift 보정: 실제 비-밴 멤버 수로 재계산
UPDATE public.communities c
SET member_count = (
  SELECT count(*) FROM public.community_members m
  WHERE m.community_id = c.id AND COALESCE(m.is_banned, false) = false
);
