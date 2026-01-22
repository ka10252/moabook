import { motion } from 'framer-motion';
import { Trash2, Check, User, BookOpen } from 'lucide-react';
import { WishlistItem } from '@/hooks/useWishlist';
import { formatDistanceToNow } from 'date-fns';

interface WishlistCardProps {
  item: WishlistItem;
  isOwner: boolean;
  onDelete?: () => void;
  onMarkFulfilled?: () => void;
}

export const WishlistCard = ({ item, isOwner, onDelete, onMarkFulfilled }: WishlistCardProps) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-card border border-border rounded-2xl p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary shrink-0" />
            <h3 className="font-semibold text-foreground truncate">{item.title}</h3>
          </div>
          {item.author && (
            <p className="text-sm text-muted-foreground mt-1">by {item.author}</p>
          )}
        </div>

        {isOwner && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onMarkFulfilled}
              className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="Mark as found"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Remove"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {item.notes && (
        <p className="text-sm text-muted-foreground bg-muted rounded-xl p-3">
          {item.notes}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" />
          <span>{item.profile?.nickname || 'Anonymous'}</span>
        </div>
        <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
      </div>
    </motion.div>
  );
};
