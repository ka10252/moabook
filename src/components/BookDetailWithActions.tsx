import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, Heart, Edit2, Trash2, Loader2 } from 'lucide-react';
import { Book } from '@/types/book';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MemberProfileModal } from '@/components/profile/MemberProfileModal';
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
  isLiked?: boolean;
  onToggleLike?: (book: Book) => Promise<void>;
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
  isLiked = false,
  onToggleLike,
  currentUserId 
}: BookDetailWithActionsProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showOwnerProfile, setShowOwnerProfile] = useState(false);

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
    if (!onToggleLike) return;
    setLikeLoading(true);
    try {
      await onToggleLike(book);
      toast.success(isLiked ? '관심 도서에서 제거했습니다' : '관심 도서에 추가했습니다');
    } catch (err) {
      toast.error('업데이트에 실패했습니다');
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
                    {book.condition === 'S' ? '새 책' : book.condition === 'A' ? '양호' : '보통'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    book.mode === 'rent' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-accent text-accent-foreground'
                  }`}>
                    {book.mode === 'rent' ? '대여' : `₩${book.price?.toLocaleString()}`}
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
                
                {/* Owner info - clickable */}
                <div 
                  className="bg-muted/50 rounded-2xl p-4 mb-4 cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => setShowOwnerProfile(true)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={book.owner?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {book.owner?.nickname?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{book.owner?.nickname || '알 수 없음'}</p>
                      {book.community && (
                        <p className="text-sm text-primary">{book.community.name}</p>
                      )}
                      {book.is_public && !book.community && (
                        <p className="text-sm text-muted-foreground">공개 도서</p>
                      )}
                    </div>
                  </div>
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
                        수정
                      </button>
                      <button 
                        className="flex-1 py-3 px-4 rounded-2xl bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2 hover:bg-destructive/20 transition-colors"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="w-4 h-4" />
                        삭제
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
                        채팅하기
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
                <AlertDialogTitle>이 책을 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{book.title}"을(를) 책장에서 영구적으로 삭제합니다. 이 작업은 취소할 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting} className="rounded-xl">
                  취소
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? '삭제 중...' : '삭제'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Owner Profile Modal */}
          <MemberProfileModal
            isOpen={showOwnerProfile}
            onClose={() => setShowOwnerProfile(false)}
            userId={book.owner_id}
          />
        </>
      )}
    </AnimatePresence>
  );
};
