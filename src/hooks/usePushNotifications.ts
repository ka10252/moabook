import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { canReceivePush, needsHomeScreenInstall } from '@/lib/platform';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/**
 * API 존재 여부만으로 판단하면 안 된다.
 * iOS는 홈 화면에 추가하지 않으면 구독 자체가 실패한다 — canReceivePush()가 그 조건까지 본다.
 */
const isPushSupported = canReceivePush();

/**
 * 알림 켜기가 실패하는 이유는 여러 가지고, 유저가 할 수 있는 조치도 제각각이다.
 * "거부됐어요" 한 마디로 뭉뚱그리면 유저는 브라우저가 막은 건지, 서버가 없는 건지,
 * 로그인이 필요한 건지 알 수 없다. 그래서 실패 사유를 그대로 돌려준다.
 */
export type PushResult =
  | 'granted' // 성공: 권한 + 구독 저장까지 완료
  | 'denied' // 방금 뜬 권한 요청을 거부/무시함
  | 'blocked' // 브라우저 설정에서 이미 차단됨 (요청 자체가 즉시 거부됨)
  | 'needs-login' // 권한은 되지만 구독을 저장할 계정이 없음
  | 'not-configured' // 권한은 받았지만 푸시 서버 키(VAPID)가 아직 없음
  | 'unsupported' // 이 브라우저/환경은 푸시 자체가 불가
  | 'no-service-worker' // 서비스 워커가 뜨지 않았다 (푸시는 SW 위에서만 동작한다)
  | 'error';

/**
 * navigator.serviceWorker.ready 는 서비스 워커가 없으면 영원히 대기한다.
 * 거부도 에러도 아니고 그냥 안 끝난다 — 그대로 await 하면 UI가 무기한 스피너로 굳는다.
 * 기다리지 않는 것보다 "안 됐다"고 말해주는 게 낫다.
 */
const SW_READY_TIMEOUT_MS = 8000;

const swReady = async (): Promise<ServiceWorkerRegistration | null> => {
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), SW_READY_TIMEOUT_MS)),
    ]);
  } catch {
    return null;
  }
};

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
    let cancelled = false;
    swReady().then(async (reg) => {
      if (cancelled || !reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (!cancelled) setIsSubscribed(!!sub);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  /** 실제 구독 + 서버 저장. 성공 여부를 사유와 함께 돌려준다. */
  const subscribe = useCallback(async (): Promise<PushResult> => {
    if (!isPushSupported) return 'unsupported';
    if (!user) return 'needs-login';
    // 키가 없으면 구독을 만들 수 없다. 성공한 척하지 않는다.
    if (!VAPID_PUBLIC_KEY) return 'not-configured';

    setLoading(true);
    try {
      const reg = await swReady();
      if (!reg) return 'no-service-worker';

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const subJSON = sub.toJSON() as { endpoint: string; keys?: object };
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: subJSON.endpoint,
          subscription: subJSON as unknown as Json,
        },
        { onConflict: 'user_id,endpoint' }
      );
      if (error) throw error;

      setIsSubscribed(true);
      setPermission('granted');
      return 'granted';
    } catch (err) {
      console.error('Push subscribe error:', err);
      return 'error';
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const unsubscribe = useCallback(async () => {
    if (!isPushSupported || !user) return;
    setLoading(true);
    try {
      const reg = await swReady();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
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
      }
      // 구독을 못 찾았더라도 끈 것으로 본다. 껐는데 토글이 켜진 채로 남으면 유저는 다시 못 끈다.
      setIsSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const requestAndSubscribe = useCallback(async (): Promise<PushResult> => {
    if (!isPushSupported) return 'unsupported';

    // 브라우저 설정에서 이미 차단해 두면 requestPermission()은 창도 안 띄우고 즉시 denied다.
    // 이 경우 "거부하셨네요"가 아니라 "설정에서 풀어주세요"를 안내해야 한다.
    if (Notification.permission === 'denied') {
      setPermission('denied');
      return 'blocked';
    }

    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== 'granted') return 'denied';

    return subscribe();
  }, [subscribe]);

  return {
    isPushSupported,
    /** iOS인데 아직 홈 화면에 추가하지 않아 푸시를 받을 수 없는 상태 */
    needsHomeScreenInstall: needsHomeScreenInstall(),
    /** 푸시 서버 키가 아직 배포되지 않았다 (로컬/미배포 환경) */
    isPushConfigured: !!VAPID_PUBLIC_KEY,
    permission,
    isSubscribed,
    loading,
    requestAndSubscribe,
    unsubscribe,
  };
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/** 실패 사유별 안내 문구 — 유저가 다음에 뭘 하면 되는지가 담겨야 한다. */
export const pushResultMessage = (result: PushResult): string => {
  switch (result) {
    case 'granted':
      return '알림을 켰습니다';
    case 'denied':
      return '알림 권한을 허용하지 않으셨어요. 나중에 프로필에서 다시 켤 수 있습니다.';
    case 'blocked':
      return '브라우저에서 이 사이트의 알림이 차단돼 있어요. 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꿔주세요.';
    case 'needs-login':
      return '알림을 받으려면 먼저 로그인이 필요해요.';
    case 'not-configured':
      return '알림 서버가 아직 준비 중이에요. 정식 배포 후 사용할 수 있습니다.';
    case 'unsupported':
      return '이 브라우저에서는 알림을 받을 수 없어요.';
    case 'no-service-worker':
      return '알림 준비에 실패했어요. 페이지를 새로고침한 뒤 다시 시도해주세요.';
    default:
      return '알림을 켜지 못했어요. 잠시 후 다시 시도해주세요.';
  }
};
