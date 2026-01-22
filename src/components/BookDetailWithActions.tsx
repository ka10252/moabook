import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, Heart, Edit2, Trash2, Loader2 } from 'lucide-react';
import { Book } from '@/types/book';
import { toast } from 'sonner';
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

interface BookDetailWithActionsProps {
  book: Book | null;
  onClose: () => void;
  onChat: (ownerId: string, bookId: string) => void;
  onEdit?: (book: Book) => void;
  onDelete?: (bookId: string) => Promise<void>;
  onAddToInterested?: (book: Book) => Promise<void>;
  currentUserId?: string;
}

// Truncate description to max 4 lines (roughly 200 chars)
const truncateDescription = (text: string, maxLength: number = 200): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

export const BookDetailWithActions = ({ 
  book, 
  onClose, 
  onChat, 
  onEdit,
  onDelete,
  onAddToInterested,
  currentUserId 
}: BookDetailWithActionsProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  if (!book) return null;

  const isOwner = currentUserId === book.owner_id;

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    await onDelete(book.id);
    setDeleting(false);
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleLike = async () => {
    setLikeLoading(true);
    try {
      if (onAddToInterested) {
        await onAddToInterested(book);
      }
      setIsLiked(!isLiked);
      toast.success(isLiked ? 'Removed from Interested Books' : 'Added to Interested Books');
    } catch (err) {
      toast.error('Failed to update');
    } finally {
      setLikeLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {book && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Modal - improved responsive sizing */}
          <motion.div
            className="fixed inset-x-4 top-[5%] md:inset-x-auto md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 z-50"
            style={{ maxHeight: '90vh' }}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="glass-card h-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header - fixed height */}
              <div className="relative h-56 flex-shrink-0">
                <img
                  src={book.cover}
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full bg-card/80 backdrop-blur-sm text-foreground hover:bg-card transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                {/* Badges */}
                <div className="absolute top-4 left-4 flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    book.condition === 'S' 
                      ? 'bg-accent text-accent-foreground' 
                      : book.condition === 'A'
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {book.condition === 'S' ? 'Like New' : book.condition === 'A' ? 'Good' : 'Used'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    book.mode === 'rent' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-accent text-accent-foreground'
                  }`}>
                    {book.mode === 'rent' ? 'For Rent' : `₩${book.price?.toLocaleString()}`}
                  </span>
                </div>
              </div>
              
              {/* Content - scrollable */}
              <div className="flex-1 overflow-y-auto p-6 min-h-0">
                <h2 className="text-2xl font-bold text-foreground mb-1">{book.title}</h2>
                <p className="text-muted-foreground mb-4">by {book.author}</p>
                
                {/* Description - max 4 lines with truncation */}
                {book.description && (
                  <p className="text-foreground/80 leading-relaxed mb-6 line-clamp-4">
                    {truncateDescription(book.description)}
                  </p>
                )}
                
                {/* Owner info */}
                <div className="bg-muted/50 rounded-2xl p-4 mb-4">
                  <p className="text-sm text-muted-foreground mb-1">Listed by</p>
                  <p className="font-semibold text-foreground">{book.owner?.nickname || 'Unknown'}</p>
                  {book.community && (
                    <p className="text-sm text-primary">{book.community.name}</p>
                  )}
                  {book.is_public && !book.community && (
                    <p className="text-sm text-muted-foreground">Public listing</p>
                  )}
                </div>
              </div>
              
              {/* Actions - removed Share button */}
              <div className="flex-shrink-0 p-4 border-t border-border bg-card/50">
                <div className="flex gap-3">
                  {isOwner ? (
                    <>
                      {/* Owner actions: Edit & Delete */}
                      <button 
                        className="flex-1 btn-hip flex items-center justify-center gap-2"
                        onClick={() => onEdit?.(book)}
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button 
                        className="flex-1 py-3 px-4 rounded-2xl bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2 hover:bg-destructive/20 transition-colors"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Non-owner: Chat with owner */}
                      <button 
                        className="btn-hip flex-1 flex items-center justify-center gap-2"
                        onClick={() => onChat(book.owner_id, book.id)}
                      >
                        <MessageCircle className="w-4 h-4" />
                        Chat with Owner
                      </button>
                    </>
                  )}
                  {/* Heart button - adds to Interested Books */}
                  <button 
                    className={`p-3 rounded-2xl transition-colors ${
                      isLiked 
                        ? 'bg-primary/20 text-primary' 
                        : 'bg-muted text-muted-foreground hover:text-primary'
                    }`}
                    onClick={handleLike}
                    disabled={likeLoading}
                  >
                    {likeLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <AlertDialogContent className="rounded-2xl max-w-[90vw] md:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this book?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove "{book.title}" from your shelf. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting} className="rounded-xl">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </AnimatePresence>
  );
};
