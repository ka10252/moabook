import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

const isPushSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    isPushSupported ? Notification.permission : 'denied'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check current subscription state on mount / user change
  useEffect(() => {
    if (!isPushSupported || !user) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    });
  }, [user?.id]);

  const subscribe = useCallback(async () => {
    if (!isPushSupported || !user || !VAPID_PUBLIC_KEY) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const subJSON = sub.toJSON() as { endpoint: string; keys?: object };
      await supabase.from('push_subscriptions').upsert(
        { user_id: user.id, endpoint: subJSON.endpoint, subscription: subJSON },
        { onConflict: 'user_id,endpoint' }
      );
      setIsSubscribed(true);
      setPermission('granted');
    } catch {
      // User denied or browser error — don't throw
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const unsubscribe = useCallback(async () => {
    if (!isPushSupported || !user) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.toJSON().endpoint;
        await sub.unsubscribe();
        if (endpoint) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', endpoint);
        }
        setIsSubscribed(false);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const requestAndSubscribe = useCallback(async () => {
    if (!isPushSupported) return;
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm === 'granted') await subscribe();
  }, [subscribe]);

  return {
    isPushSupported,
    permission,
    isSubscribed,
    loading,
    requestAndSubscribe,
    unsubscribe,
  };
};
