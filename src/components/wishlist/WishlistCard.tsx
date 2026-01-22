import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Check, User, BookOpen, MessageCircle } from 'lucide-react';
import { WishlistItem } from '@/hooks/useWishlist';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface WishlistCardProps {
  item: WishlistItem;
  isOwner: boolean;
  onDelete?: () => void;
  onMarkFulfilled?: () => void;
  onMessage?: () => void;
}

export const WishlistCard = ({ item, isOwner, onDelete, onMarkFulfilled, onMessage }: WishlistCardProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    onDelete?.();
    setShowDeleteConfirm(false);
  };

  return (
    <>
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
        </div>

        {item.notes && (
          <p className="text-sm text-muted-foreground bg-muted rounded-xl p-3">
            {item.notes}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="w-3.5 h-3.5" />
            <span>{item.profile?.nickname || 'Anonymous'}</span>
            <span className="mx-1">·</span>
            <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
          </div>

          {/* Action Icons: Message | Check | Trash */}
          <div className="flex items-center gap-1">
            {/* Message - for non-owners to contact requester */}
            {!isOwner && onMessage && (
              <button
                onClick={onMessage}
                className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Message requester"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            )}

            {/* Check - owner marks as fulfilled */}
            {isOwner && onMarkFulfilled && (
              <button
                onClick={onMarkFulfilled}
                className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Mark as found"
              >
                <Check className="w-4 h-4" />
              </button>
            )}

            {/* Trash - owner deletes with confirmation */}
            {isOwner && onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>이 요청을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              위시리스트 요청을 삭제합니다. 이 작업은 취소할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
