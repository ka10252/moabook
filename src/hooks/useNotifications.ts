import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// 이 훅은 헤더 배지·알림 패널 등 여러 곳에서 동시에 마운트된다.
// 각 인스턴스가 같은 INSERT 이벤트를 받으므로, 토스트를 그냥 띄우면 같은 알림이 여러 번 뜬다.
// 이미 토스트로 보여준 알림 id를 모듈 전역에 기록해 한 번만 띄운다.
const toastedNotificationIds = new Set<string>();

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // 미확인 개수는 목록에서 파생한다 → 읽음/삭제/실시간 변경이 항상 배지에 즉시 반영된다.
  const [loading, setLoading] = useState(true);
  const channelIdRef = useRef(Math.random().toString(36).slice(2, 10));

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const items = (data || []) as Notification[];
      setNotifications(items);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // 알림 권한은 여기서 요청하지 않는다.
  //  - iOS는 "유저 클릭" 없이 호출한 requestPermission()을 무시한다.
  //  - 크롬 계열도 페이지 로드 직후의 무맥락 권한 요청을 나쁜 패턴으로 취급한다(차단/무시 가능).
  // 권한 요청은 프로필의 '백그라운드 알림' 토글(유저 제스처)에서만 한다 → usePushNotifications.requestAndSubscribe()

  // Real-time subscription + browser push
  useEffect(() => {
    if (!user) return;

    // 훅이 여러 곳(헤더 배지 / 알림 패널)에서 동시에 마운트된다.
    // 채널 토픽이 같으면 뒤에 구독한 쪽이 실시간 이벤트를 못 받는다.
    const channel = supabase
      .channel(`notifications-changes:${user.id}:${channelIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => {
            // 중복 인스턴스가 같은 이벤트를 받아 목록에 두 번 넣지 않도록 막는다
            if (prev.some(n => n.id === newNotification.id)) return prev;
            return [newNotification, ...prev];
          });

          if (document.hidden) {
            // 탭이 안 보일 때 — OS/브라우저 알림
            if ('Notification' in window && Notification.permission === 'granted') {
              new window.Notification(newNotification.title, {
                body: newNotification.body ?? undefined,
                icon: '/moa-logo.png',
              });
            }
          } else if (!toastedNotificationIds.has(newNotification.id)) {
            // 앱을 보고 있을 때 — 브라우저가 OS 알림을 억제하므로 인앱 토스트로 알린다.
            // (여러 인스턴스가 동시에 받아도 id로 한 번만 띄운다)
            toastedNotificationIds.add(newNotification.id);
            toast(newNotification.title, {
              description: newNotification.body ?? undefined,
              duration: 5000,
            });
          }
        }
      )
      // 다른 인스턴스(헤더 배지↔알림 팝업)에서 읽음 처리하면 여기서도 반영 → 배지 개수 즉시 동기화
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications(prev => prev.map(n => (n.id === updated.id ? updated : n)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const removed = payload.old as { id?: string };
          if (removed?.id) setNotifications(prev => prev.filter(n => n.id !== removed.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  const deleteNotification = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications,
  };
};
