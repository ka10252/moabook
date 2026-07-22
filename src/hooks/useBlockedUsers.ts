import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface BlockedUser {
  id: string;
  blocked_id: string;
  created_at: string;
  nickname?: string;
}

/**
 * 내가 차단한 유저 목록.
 * 차단은 양방향으로 작동한다 — 상대가 나를 차단해도 서로의 콘텐츠·메시지가 막힌다.
 * 메시지 차단은 RLS(is_blocked_between)로 서버에서 강제하고, 목록 숨김은 여기서 처리한다.
 */
export const useBlockedUsers = () => {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlocked = useCallback(async () => {
    if (!user) {
      setBlocked([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('blocked_users')
      .select('id, blocked_id, created_at, profile:profiles!blocked_users_blocked_id_fkey(nickname)')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch blocked users:', error);
    } else {
      setBlocked(
        (data ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          blocked_id: row.blocked_id as string,
          created_at: row.created_at as string,
          nickname: (row.profile as { nickname?: string } | null)?.nickname,
        }))
      );
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchBlocked();
  }, [fetchBlocked]);

  const blockUser = async (targetUserId: string): Promise<{ error: string | null }> => {
    if (!user) return { error: '로그인이 필요합니다' };
    if (user.id === targetUserId) return { error: '자기 자신은 차단할 수 없습니다' };

    const { error } = await supabase
      .from('blocked_users')
      .insert({ blocker_id: user.id, blocked_id: targetUserId });

    if (error) {
      if (error.code === '23505') return { error: '이미 차단한 사용자입니다' };
      return { error: error.message };
    }
    await fetchBlocked();
    return { error: null };
  };

  const unblockUser = async (targetUserId: string): Promise<{ error: string | null }> => {
    if (!user) return { error: '로그인이 필요합니다' };

    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', targetUserId);

    if (error) return { error: error.message };
    await fetchBlocked();
    return { error: null };
  };

  const blockedIds = new Set(blocked.map((b) => b.blocked_id));
  const isBlocked = (userId: string) => blockedIds.has(userId);

  return { blocked, blockedIds, isBlocked, blockUser, unblockUser, loading, refresh: fetchBlocked };
};
