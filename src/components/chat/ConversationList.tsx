import { motion } from 'framer-motion';
import { MessageCircle, Loader2 } from 'lucide-react';
import { Conversation } from '@/hooks/useChat';
import { formatDistanceToNow } from 'date-fns';

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
          className={`w-full p-4 flex items-start gap-3 text-left transition-colors hover:bg-muted/50 ${
            selectedId === conv.id ? 'bg-muted' : ''
          }`}
          whileTap={{ scale: 0.98 }}
        >
          {/* Avatar / Book cover */}
          <div className="w-12 h-12 rounded-xl bg-muted shrink-0 overflow-hidden">
            {conv.book?.cover_url ? (
              <img
                src={conv.book.cover_url}
                alt={conv.book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <MessageCircle className="w-5 h-5" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground truncate">
                {conv.other_user?.nickname || 'Unknown'}
              </h3>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
              </span>
            </div>

            {conv.book && (
              <p className="text-xs text-primary truncate mt-0.5">
                Re: {conv.book.title}
              </p>
            )}

            <p className="text-sm text-muted-foreground truncate mt-1">
              {conv.last_message || 'No messages yet'}
            </p>
          </div>

          {/* Unread badge - KakaoTalk style */}
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
