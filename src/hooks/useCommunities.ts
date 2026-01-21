import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Community {
  id: string;
  name: string;
  memberCount: number;
}

export const useCommunities = () => {
  const { user } = useAuth();
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setMyCommunities([]);
      return;
    }

    const fetchMyCommunities = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('community_members')
          .select(`
            community_id,
            communities (
              id,
              name,
              member_count
            )
          `)
          .eq('user_id', user.id);

        if (fetchError) throw fetchError;

        const communities: Community[] = (data || [])
          .filter((item) => item.communities)
          .map((item) => ({
            id: item.communities!.id,
            name: item.communities!.name,
            memberCount: item.communities!.member_count || 0,
          }));

        setMyCommunities(communities);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch communities');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyCommunities();
  }, [user]);

  return {
    myCommunities,
    isLoading,
    error,
  };
};
