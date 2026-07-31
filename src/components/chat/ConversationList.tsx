import { motion } from 'framer-motion';
import { MessageCircle, Loader2, BookOpen } from 'lucide-react';
import { Conversation } from '@/hooks/useChat';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

const SPECIAL_PREFIX_MAP: Record<string, string> = {
  '[대여 요청]': '대여 요청',
  '[구매 요청]': '구매 요청',
  '[나눔 요청]': '나눔 요청',
  '[대여 수락]': '대여 수락됨',
  '[판매 완료]': '판매 완료',
  '[나눔 완료]': '나눔 완료',
  '[반납 완료]': '반납 완료',
  '[반납 요청]': '반납 요청',
};

const formatLastMessage = (content: string | undefined): string => {
  if (!content) return '메시지 없음';
  for (const [prefix, label] of Object.entries(SPECIAL_PREFIX_MAP)) {
    if (content.startsWith(prefix)) return label;
  }
  return content.replace(/\s*\[BOOK_ID:[^\]]+\]/, '');
};

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
}

export const ConversationList = ({ conversations, loading, selectedId, onSelect }: ConversationListProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <MessageCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">No messages yet</p>
        <p className="text-muted-foreground/70 text-xs mt-1">
          Start a conversation by tapping "Chat" on a book
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {conversations.map((conv) => (
        <motion.button
          key={conv.id}
          onClick={() => onSelect(conv)}
          className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors hover:bg-muted/50 ${
            selectedId === conv.id ? 'bg-muted' : ''
          }`}
          whileTap={{ scale: 0.98 }}
        >
          {/* Book cover thumbnail */}
          <div className="relative shrink-0">
            <div className="w-11 h-14 rounded-lg bg-muted overflow-hidden shadow-sm">
              {conv.book?.cover_url ? (
                <img src={conv.book.cover_url} alt={conv.book.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <BookOpen className="w-5 h-5 opacity-40" />
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground text-sm truncate">
                  {conv.other_user?.nickname || 'Unknown'}
                </h3>
                {conv.book && (
                  <p className="text-[13px] text-primary/80 truncate mt-0.5 font-medium">
                    📖 {conv.book.title}
                  </p>
                )}
              </div>
              <span className="text-[13px] text-muted-foreground shrink-0 mt-0.5">
                {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: ko })}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate mt-1">
              {formatLastMessage(conv.last_message)}
            </p>
          </div>

          {/* Unread badge */}
          {conv.unread_count > 0 && (
            <div className="min-w-5 h-5 px-1.5 rounded-full bg-[hsl(var(--destructive))] text-white text-xs font-bold flex items-center justify-center shrink-0 border border-white shadow-sm">
              {conv.unread_count > 99 ? '99+' : conv.unread_count}
            </div>
          )}
        </motion.button>
      ))}
    </div>
  );
};
