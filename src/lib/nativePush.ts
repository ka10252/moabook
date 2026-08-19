import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { isNative, isIOS } from '@/lib/native';

/**
 * 앱(iOS) 푸시 — APNs 기기 토큰 등록.
 *
 * 웹 푸시(VAPID + 서비스워커)와는 **채널이 아예 다르다.** WKWebView 에는 Push API 자체가
 * 없어서, 웹 코드를 그대로 두면 앱 사용자는 알림을 하나도 못 받는다.
 *
 * 저장은 같은 `push_subscriptions` 표를 쓰되 `channel` 로 구분한다(마이그 20260823000001).
 *   web : endpoint = 브라우저가 준 URL      · subscription = { endpoint, keys }
 *   ios : endpoint = APNs 기기 토큰(고유)   · subscription = { token }
 */
export const canUseNativePush = isNative && isIOS;

export type NativePushResult = 'granted' | 'denied' | 'needs-login' | 'error';

/** 토큰이 도착하기를 기다린다 — 등록 요청과 토큰 수신이 비동기로 갈린다 */
const TOKEN_TIMEOUT_MS = 10000;

export async function enableNativePush(userId: string | undefined): Promise<NativePushResult> {
  if (!canUseNativePush) return 'error';
  if (!userId) return 'needs-login';

  const { PushNotifications } = await import('@capacitor/push-notifications');

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') return 'denied';

  // register() 는 즉시 반환하고, 토큰은 'registration' 이벤트로 뒤늦게 온다.
  // 먼저 리스너를 걸어두지 않으면 놓친다.
  const token = await new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), TOKEN_TIMEOUT_MS);
    PushNotifications.addListener('registration', (t) => {
      clearTimeout(timer);
      resolve(t.value);
    });
    PushNotifications.addListener('registrationError', () => {
      clearTimeout(timer);
      resolve(null);
    });
    void PushNotifications.register();
  });

  if (!token) return 'error';

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: token,                       // APNs 토큰은 그 자체로 고유하다
      subscription: { token } as unknown as Json,
      channel: 'ios',
    } as never,
    { onConflict: 'user_id,endpoint' },
  );
  if (error) return 'error';
  return 'granted';
}

export async function disableNativePush(userId: string | undefined): Promise<void> {
  if (!canUseNativePush || !userId) return;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  // iOS 는 앱에서 권한을 되돌릴 수 없다(설정에서만 가능) — 우리가 할 수 있는 건
  // 보내지 않는 것이다. 그래서 토큰을 지운다.
  await PushNotifications.removeAllListeners().catch(() => {});
  await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('channel', 'ios');
}

/** 이 기기에 이미 등록돼 있나 */
export async function hasNativePush(userId: string | undefined): Promise<boolean> {
  if (!canUseNativePush || !userId) return false;
  const { count } = await supabase
    .from('push_subscriptions')
    .select('endpoint', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('channel', 'ios');
  return (count ?? 0) > 0;
}

/**
 * 알림 관련 이벤트 배선. 앱이 뜰 때 한 번 부른다.
 *
 * 두 가지를 다룬다:
 *  1. **알림을 눌러 들어온 경우** → 그 화면으로 옮긴다 (페이로드의 url, send-push 가 넣는다)
 *  2. **앱을 보고 있을 때 온 알림** → iOS 는 이걸 **아무것도 안 하고 삼킨다.**
 *     배너를 띄우지 않는 게 iOS 기본 동작이라, 그냥 두면 채팅을 보고 있는 동안
 *     다른 대화에 온 메시지를 전혀 모른다. 앱 안에서 직접 알려준다.
 */
export async function initNativePushTaps(
  navigate: (path: string) => void,
  onForeground?: (msg: { title: string; body: string; url: string }) => void,
): Promise<void> {
  if (!canUseNativePush) return;
  const { PushNotifications } = await import('@capacitor/push-notifications');

  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = (action.notification.data as { url?: string })?.url;
    if (url) navigate(url);
  });

  if (onForeground) {
    await PushNotifications.addListener('pushNotificationReceived', (n) => {
      onForeground({
        title: n.title ?? '',
        body: n.body ?? '',
        url: (n.data as { url?: string })?.url ?? '/',
      });
    });
  }
}
