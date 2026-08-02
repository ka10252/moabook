import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

// 이 훅은 헤더 배지·알림 팝업 등 여러 곳에서 동시에 마운트된다.
// 각자 별도 상태를 두면 한쪽에서 읽음 처리해도 다른 쪽(배지)이 새로고침 전엔 안 바뀐다.
// → 모듈 전역 "공유 스토어" 하나를 두고 모두가 같은 상태를 본다. 읽음/삭제가 즉시 모든 곳에 반영된다.

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

// 같은 알림 토스트가 여러 번 뜨지 않도록 기록
const toastedNotificationIds = new Set<string>();

// ---- 공유 스토어 ----
let notifications: Notification[] = [];
let loading = true;
let storeUserId: string | null = null;
let channel: RealtimeChannel | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const getNotifications = () => notifications;
const getLoading = () => loading;
const setNotifications = (next: Notification[]) => { notifications = next; emit(); };

async function fetchNotifications() {
  if (!storeUserId) { notifications = []; loading = false; emit(); return; }
  loading = true; emit();
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', storeUserId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    notifications = (data || []) as Notification[];
  } catch (err) {
    console.error('Failed to fetch notifications:', err);
  } finally {
    loading = false; emit();
  }
}

function setupFor(userId: string | null) {
  if (userId === storeUserId && (channel || !userId)) return; // 이미 이 유저로 구성됨
  if (channel) { supabase.removeChannel(channel); channel = null; }
  storeUserId = userId;
  if (!userId) { setNotifications([]); loading = false; emit(); return; }

  fetchNotifications();

  // 채널 토픽은 유저별로 고정 — 스토어가 하나뿐이라 인스턴스별 랜덤 토픽이 필요 없다.
  channel = supabase
    .channel(`notifications-store:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        const n = payload.new as Notification;
        if (notifications.some((x) => x.id === n.id)) return;
        setNotifications([n, ...notifications]);
        if (document.hidden) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new window.Notification(n.title, { body: n.body ?? undefined, icon: '/moa-logo.png' });
          }
        } else if (!toastedNotificationIds.has(n.id)) {
          toastedNotificationIds.add(n.id);
          toast(n.title, { description: n.body ?? undefined, duration: 3000 });
        }
      },
    )
    // 읽음(UPDATE)/삭제(DELETE)도 반영 — 다른 기기/탭에서 바뀌어도 동기화
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        const u = payload.new as Notification;
        setNotifications(notifications.map((x) => (x.id === u.id ? u : x)));
      },
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        const id = (payload.old as { id?: string })?.id;
        if (id) setNotifications(notifications.filter((x) => x.id !== id));
      },
    )
    .subscribe();
}

// ---- mutations (공유 스토어 + DB) ----
async function markAsRead(id: string) {
  setNotifications(notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
}

async function markAllAsRead() {
  if (!storeUserId) return;
  if (!notifications.some((n) => !n.is_read)) return;
  setNotifications(notifications.map((n) => ({ ...n, is_read: true }))); // 낙관적 → 배지 즉시 0
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', storeUserId).eq('is_read', false);
}

async function deleteNotification(id: string) {
  setNotifications(notifications.filter((n) => n.id !== id));
  await supabase.from('notifications').delete().eq('id', id);
}

async function deleteAllNotifications() {
  if (!storeUserId) return;
  if (notifications.length === 0) return;
  setNotifications([]); // 낙관적 → 목록 즉시 비움
  await supabase.from('notifications').delete().eq('user_id', storeUserId);
}

export const useNotifications = () => {
  const { user } = useAuth();

  useEffect(() => { setupFor(user?.id ?? null); }, [user?.id]);

  const notifs = useSyncExternalStore(subscribe, getNotifications, getNotifications);
  const isLoading = useSyncExternalStore(subscribe, getLoading, getLoading);
  const unreadCount = notifs.filter((n) => !n.is_read).length;

  return {
    notifications: notifs,
    unreadCount,
    loading: isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    refresh: fetchNotifications,
  };
};
