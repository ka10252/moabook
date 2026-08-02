import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { BADGES, type BadgeId } from '@/components/BadgeStamp';

export interface EarnedBadge {
  badge_key: BadgeId;
  tier: number;
}

// 세션당 award_badges 1회만 호출(중복 토스트 방지). award는 '새로 딴 것'만 돌려주므로
// 재호출해도 [] 지만, 불필요한 호출을 줄인다.
let awardedThisSession = false;

/** 내 배지 — 진입 시 자격 판정(소급 발급) + 새로 딴 것 토스트. */
export function useBadges() {
  const { user } = useAuth();
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMine = useCallback(async () => {
    if (!user) { setBadges([]); setLoading(false); return; }
    const { data } = await supabase
      .from('user_badges')
      .select('badge_key, tier')
      .eq('user_id', user.id);
    setBadges((data ?? []) as EarnedBadge[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user) { setBadges([]); setLoading(false); return; }
    (async () => {
      try {
        if (!awardedThisSession) {
          awardedThisSession = true;
          const { data } = await supabase.rpc('award_badges' as any);
          const newly = (data as { key: BadgeId; tier: number }[] | null) ?? [];
          for (const b of newly) {
            const name = BADGES[b.key]?.name ?? '배지';
            toast.success(`🎉 '${name}' 배지를 획득했어요!`);
          }
        }
      } catch {
        // 마이그 미배포/일시 오류는 조용히 무시(프로필은 정상 떠야 함)
      }
      fetchMine();
    })();
  }, [user?.id, fetchMine]);

  return { badges, loading, refresh: fetchMine };
}

/** 임의 유저의 배지(멤버 프로필용). */
export async function fetchUserBadges(userId: string): Promise<EarnedBadge[]> {
  const { data } = await supabase
    .from('user_badges')
    .select('badge_key, tier')
    .eq('user_id', userId);
  return (data ?? []) as EarnedBadge[];
}
