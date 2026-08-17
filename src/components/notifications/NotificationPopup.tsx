import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Trash2, Loader2, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { usePushNotifications, pushResultMessage } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { routeFor } from '@/lib/notificationRoutes';
import { toast } from 'sonner';

const SETUP_DISMISS_KEY = 'moa_notif_setup_dismissed';
const TELEGRAM_BOT = 'MOAbook_bot';

/**
 * 벨 팝업 상단 '알림 설정' 카드 — 온보딩을 건너뛰어 아직 푸시·텔레그램 어느 것도 안 켠 유저에게.
 * 닫으면(X) 영구히 다시 안 뜬다(b1). 둘 중 하나라도 켜져 있으면 아예 안 뜬다.
 */
const NotifSetupCard = () => {
  const { user } = useAuth();
  const { isSubscribed, isPushSupported, needsHomeScreenInstall, requestAndSubscribe, loading } = usePushNotifications();
  const [tgLinked, setTgLinked] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(SETUP_DISMISS_KEY));

  useEffect(() => {
    if (!user) return;
    supabase.rpc('am_i_telegram_linked' as any)
      .then(({ data }) => setTgLinked(!!data));
  }, [user]);

  // 로딩 중이거나(깜빡임 방지), 닫았거나, 이미 하나라도 켠 유저에겐 숨긴다
  if (dismissed || tgLinked === null || isSubscribed || tgLinked) return null;

  const enablePush = async () => {
    if (needsHomeScreenInstall) { toast.info('iPhone은 홈 화면에 추가한 뒤 알림을 켤 수 있어요'); return; }
    const r = await requestAndSubscribe();
    (r === 'granted' ? toast.success : toast.error)(pushResultMessage(r));
  };

  const connectTelegram = async () => {
    if (!user) return;
    const code = Array.from(crypto.getRandomValues(new Uint8Array(9)))
      .map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
    await supabase.from('profiles').update({ telegram_link_code: code }).eq('id', user.id);
    window.open(`https://t.me/${TELEGRAM_BOT}?start=${code}`, '_blank');
    toast.info('텔레그램에서 "시작"을 누르면 연동돼요');
  };

  const dismiss = () => { localStorage.setItem(SETUP_DISMISS_KEY, '1'); setDismissed(true); };

  return (
    <div className="m-2 mb-0 rounded-xl bg-primary/8 border border-primary/25 p-3.5 relative">
      <button onClick={dismiss} aria-label="닫기"
        className="absolute right-2 top-2 p-1 rounded-md text-muted-foreground hover:bg-primary/10">
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-center gap-1.5 text-[15px] font-bold text-foreground pr-6">
        <Bell className="w-3.5 h-3.5 text-primary" /> 알림을 켜세요
      </div>
      <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
        대여 요청·반납일을 놓치지 않게, <span className="text-foreground font-medium">텔레그램</span>으로 받는 걸 추천해요.
      </p>
      <div className="flex gap-2 mt-2.5">
        {/* 1순위: 텔레그램(기본 채널) */}
        <button onClick={connectTelegram}
          className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-[15px] font-bold flex items-center justify-center gap-1.5">
          <Send className="w-3.5 h-3.5" /> 텔레그램으로 받기
        </button>
        {/* 2순위: 앱 알림(텔레그램 없거나 앱처럼 쓰고 싶은 사람) */}
        {(isPushSupported || needsHomeScreenInstall) && (
          <button onClick={enablePush} disabled={loading}
            className="flex-1 h-9 rounded-lg bg-card border border-primary/40 text-primary text-[15px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-70">
            <Plus className="w-3.5 h-3.5" /> 앱 알림
          </button>
        )}
      </div>
    </div>
  );
};

interface NotificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChat?: (target: { userId: string; conversationId?: string }) => void;
  /** 위시 매칭·커뮤니티 새 책 → 그 책을 연다 */
  onOpenBook?: (bookId: string) => void;
  /** 반납 임박·연체 → 거래 현황을 연다 */
  onOpenTransactions?: () => void;
  /** 커뮤니티 새 멤버 → 커뮤니티 탭을 연다 */
  onOpenCommunity?: (communityId: string) => void;
  /** 공지 알림 → 공지 팝업을 연다 */
  onOpenAnnouncement?: () => void;
}

export const NotificationPopup = ({
  isOpen,
  onClose,
  onOpenChat,
  onOpenBook,
  onOpenTransactions,
  onOpenCommunity,
  onOpenAnnouncement,
}: NotificationPopupProps) => {
  const { notifications, loading, markAllAsRead, deleteNotification, deleteAllNotifications } = useNotifications();

  // 창을 열 때 "그 시점에 안 읽었던 알림 id"를 얼려둔다(빨간 점·강조 배경 표시용).
  // 열자마자 markAllAsRead로 is_read가 즉시 true가 돼도, 이 스냅샷으로 빨간 점을 창이 열려 있는 동안 유지한다.
  // → 알림이 여러 개 쌓여 있어도 "방금까지 안 읽은 게 어떤 것인지" 구분 가능. 창을 닫으면 스냅샷을 비워 사라진다.
  const [sessionUnreadIds, setSessionUnreadIds] = useState<Set<string>>(new Set());

  // 알림창을 열면(로딩 완료 후) 쌓인 알림을 자동으로 읽음 처리 → 헤더 배지 즉시 사라짐(새로고침 불필요).
  const markedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) { markedRef.current = false; setSessionUnreadIds(new Set()); return; }
    if (loading || markedRef.current) return;
    markedRef.current = true;
    // markAllAsRead가 is_read를 바꾸기 전에 스냅샷을 먼저 캡처한다.
    setSessionUnreadIds(new Set(notifications.filter((n) => !n.is_read).map((n) => n.id)));
    markAllAsRead();
  }, [isOpen, loading, markAllAsRead, notifications]);

  /**
   * 알림을 눌렀는데 아무 일도 안 일어나면, 유저는 다음부터 알림을 안 누른다.
   * 모든 알림은 "그래서 뭘 보라는 건데?"에 답하는 화면으로 이어져야 한다.
   */
  const handleNotificationClick = async (notification: Notification) => {
    // 읽음 처리는 창을 열 때 이미 일괄로 했다(위 useEffect). 여기선 이동만.
    // 연결표는 notificationRoutes.ts 한 곳에만 있다. 여기서 타입을 나열하기 시작하면
    // 새 알림이 추가될 때마다 한쪽만 고쳐지고 다른 쪽은 죽은 링크로 남는다.
    const route = routeFor(notification.type);
    if (!route) return;

    const data = notification.data ?? {};

    switch (route.destination) {
      case 'chat': {
        const userId = data.sender_id as string | undefined;
        const conversationId = data.conversation_id as string | undefined;
        if (!userId && !conversationId) return;
        // 같은 상대와 책별로 여러 대화가 있을 수 있다. sender_id만으로는 엉뚱한 방이 열린다.
        onClose();
        onOpenChat?.({ userId: userId ?? '', conversationId });
        return;
      }
      case 'book': {
        const bookId = data.book_id as string | undefined;
        if (!bookId) return;
        onClose();
        onOpenBook?.(bookId);
        return;
      }
      case 'transactions': {
        onClose();
        onOpenTransactions?.();
        return;
      }
      case 'community': {
        const communityId = data.community_id as string | undefined;
        if (!communityId) return;
        onClose();
        onOpenCommunity?.(communityId);
        return;
      }
      case 'announcement': {
        onClose();
        onOpenAnnouncement?.();
        return;
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="notification-backdrop"
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Popup */}
          <motion.div
            key="notification-modal"
            className="w-[calc(100%-2rem)] max-w-sm h-fit box-border"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
              {/* Header */}
              <header className="flex items-end justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
                <div>
                  <p className="eyebrow flex items-center gap-1.5"><Bell className="w-3 h-3" /> Updates</p>
                  <h3 className="font-display text-[22px] font-medium tracking-tight text-foreground mt-0.5">알림</h3>
                </div>
                <div className="flex items-center gap-1">
                  {notifications.some(n => !n.is_read) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={markAllAsRead}
                      className="text-xs text-primary"
                    >
                      모두 읽음
                    </Button>
                  )}
                  {notifications.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={deleteAllNotifications}
                      className="text-xs text-muted-foreground"
                    >
                      모두 삭제
                    </Button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-full hover:bg-muted transition-colors"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </header>

              {/* 알림 설정 유도 카드 (아직 푸시·텔레그램 안 켠 유저에게, 닫으면 영구 숨김) */}
              <NotifSetupCard />

              {/* Content */}
              <ScrollArea className="flex-1 min-h-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <Bell className="w-12 h-12 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">
                      알림이 없습니다
                    </p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {notifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          "relative p-3 rounded-xl cursor-pointer transition-colors group",
                          // 미확인 강조는 '창을 열 때의 스냅샷' 기준 — 창이 열려 있는 동안 유지, 닫으면 사라짐
                          sessionUnreadIds.has(notification.id)
                            ? "bg-primary/5 hover:bg-primary/10"
                            : "bg-transparent hover:bg-muted/50"
                        )}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        {/* Unread indicator — 창 여는 순간 미확인이던 알림에만, 닫을 때까지 표시 */}
                        {sessionUnreadIds.has(notification.id) && (
                          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full" />
                        )}

                        <div className="pl-3">
                          <p className="font-medium text-foreground text-sm">
                            {notification.title}
                          </p>
                          {notification.body && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {notification.body}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                              locale: ko,
                            })}
                          </p>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
