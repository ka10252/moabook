import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Announcement {
  id: string;
  admin_message: string;
  updated_at: string;
  updated_by: string | null;
}

const LAST_SEEN_KEY = 'announcement_last_seen';

export const useAnnouncement = () => {
  const queryClient = useQueryClient();
  const [hasNewAnnouncement, setHasNewAnnouncement] = useState(false);

  const { data: announcement, isLoading } = useQuery({
    queryKey: ['announcement'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_announcements')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      return data as Announcement;
    },
  });

  // Check if there's a new announcement
  useEffect(() => {
    if (announcement && announcement.admin_message) {
      const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
      if (!lastSeen || new Date(lastSeen) < new Date(announcement.updated_at)) {
        setHasNewAnnouncement(true);
      } else {
        setHasNewAnnouncement(false);
      }
    } else {
      setHasNewAnnouncement(false);
    }
  }, [announcement]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('announcement-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_announcements',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['announcement'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const markAsSeen = () => {
    if (announcement) {
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
      setHasNewAnnouncement(false);
    }
  };

  const updateAnnouncementMutation = useMutation({
    mutationFn: async (message: string) => {
      const { data: existing } = await supabase
        .from('site_announcements')
        .select('id')
        .limit(1)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('site_announcements')
          .update({ 
            admin_message: message, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('site_announcements')
          .insert({ admin_message: message });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcement'] });
      toast.success('공지 업데이트 완료', {
        description: '관리자 메시지가 성공적으로 업데이트되었습니다.',
      });
    },
    onError: (error) => {
      toast.error('업데이트 실패', { description: error.message });
    },
  });

  return {
    announcement,
    isLoading,
    hasNewAnnouncement,
    markAsSeen,
    updateAnnouncement: updateAnnouncementMutation.mutate,
    isUpdating: updateAnnouncementMutation.isPending,
  };
};
