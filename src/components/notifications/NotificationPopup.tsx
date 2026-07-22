import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Check, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { routeFor } from '@/lib/notificationRoutes';

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
}

export const NotificationPopup = ({
  isOpen,
  onClose,
  onOpenChat,
  onOpenBook,
  onOpenTransactions,
  onOpenCommunity,
}: NotificationPopupProps) => {
  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  /**
   * 알림을 눌렀는데 아무 일도 안 일어나면, 유저는 다음부터 알림을 안 누른다.
   * 모든 알림은 "그래서 뭘 보라는 건데?"에 답하는 화면으로 이어져야 한다.
   */
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

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
                  <h3 className="font-display text-[20px] font-medium tracking-tight text-foreground mt-0.5">알림</h3>
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
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-full hover:bg-muted transition-colors"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </header>

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
                          notification.is_read
                            ? "bg-transparent hover:bg-muted/50"
                            : "bg-primary/5 hover:bg-primary/10"
                        )}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        {/* Unread indicator */}
                        {!notification.is_read && (
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
