import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, Heart, Edit2, Trash2, Loader2, Clock } from 'lucide-react';
import { Book } from '@/types/book';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MemberProfileModal } from '@/components/profile/MemberProfileModal';
import { DefaultBookCover } from '@/components/DefaultBookCover';
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
  onChat: (ownerId: string, bookId: string, bookMode: 'rent' | 'sell') => void;
  onEdit?: (book: Book) => void;
  onDelete?: (bookId: string) => Promise<void>;
  isLiked?: boolean;
  onToggleLike?: (book: Book) => Promise<void>;
  currentUserId?: string;
}

interface SiblingBook {
  id: string;
  status: 'available' | 'rented' | 'sold';
  mode: 'rent' | 'sell';
  owner_id: string;
  owner?: { nickname: string; avatar_url?: string | null };
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
  const [isInWaitlist, setIsInWaitlist] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [siblingBooks, setSiblingBooks] = useState<SiblingBook[]>([]);

  useEffect(() => {
    if (!book) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [book, onClose]);

  // Reset siblings when book changes
  useEffect(() => {
    setSiblingBooks([]);
    if (!book) return;
    supabase
      .from('books')
      .select('id, status, mode, owner_id, profile:profiles!books_owner_id_fkey(nickname, avatar_url)')
      .ilike('title', book.title)
      .ilike('author', book.author)
      .neq('id', book.id)
      .eq('is_public', true)
      .neq('status', 'sold')
      .then(({ data }) => {
        if (!data) return;
        setSiblingBooks(data.map((row: any) => ({
          id: row.id,
          status: row.status,
          mode: row.mode,
          owner_id: row.owner_id,
          owner: row.profile ? { nickname: row.profile.nickname, avatar_url: row.profile.avatar_url } : undefined,
        })));
      });
  }, [book?.id]);

  // Load waitlist info when a rented book is shown
  useEffect(() => {
    if (!book || book.status !== 'rented' || !currentUserId) return;
    const load = async () => {
      const [myEntry, countResult] = await Promise.all([
        supabase.from('book_waitlist').select('id').eq('book_id', book.id).eq('user_id', currentUserId).maybeSingle(),
        supabase.from('book_waitlist').select('id', { count: 'exact' }).eq('book_id', book.id),
      ]);
      setIsInWaitlist(!!myEntry.data);
      setWaitlistCount(countResult.count ?? 0);
    };
    load();
  }, [book?.id, book?.status, currentUserId]);

  const handleWaitlist = async () => {
    if (!book || !currentUserId) return;
    setWaitlistLoading(true);
    if (isInWaitlist) {
      await supabase.from('book_waitlist').delete().eq('book_id', book.id).eq('user_id', currentUserId);
      setIsInWaitlist(false);
      setWaitlistCount(c => Math.max(0, c - 1));
      toast.success('대기열에서 취소했습니다');
    } else {
      const { error } = await supabase.from('book_waitlist').insert({ book_id: book.id, user_id: currentUserId });
      if (error) { toast.error('대기 등록에 실패했습니다'); }
      else { setIsInWaitlist(true); setWaitlistCount(c => c + 1); toast.success('대기열에 등록되었습니다. 반납 시 알림을 드릴게요!'); }
    }
    setWaitlistLoading(false);
  };

  if (!book) return null;

  const isOwner = currentUserId === book.owner_id;
  const hasValidCover = book.cover && book.cover.length > 0;

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
    <>
      <AnimatePresence>
        {book && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className="w-[calc(100%-2rem)] max-w-lg box-border"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="glass-card h-full max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header - fixed height */}
                <div className="relative h-56 flex-shrink-0">
                  {hasValidCover ? (
                    <img
                      src={book.cover}
                      alt={book.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <DefaultBookCover 
                      title={book.title} 
                      author={book.author} 
                      className="w-full h-full"
                    />
                  )}
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
                  <p className="eyebrow">{book.mode === 'rent' ? 'For Rent' : 'For Sale'}</p>
                  <h2 className="font-display text-[26px] font-medium leading-tight tracking-tight text-foreground mt-1.5 mb-1">{book.title}</h2>
                  <p className="font-display italic text-muted-foreground mb-5">by {book.author}</p>
                  
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

                  {/* Sibling books — other owners of the same title */}
                  {siblingBooks.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">
                        이 책을 가진 다른 이웃 ({siblingBooks.length})
                      </p>
                      <div className="space-y-2">
                        {siblingBooks.map((sibling) => (
                          <div key={sibling.id} className="bg-muted/40 rounded-xl p-3 flex items-center gap-3">
                            <Avatar className="w-8 h-8 shrink-0">
                              <AvatarImage src={sibling.owner?.avatar_url || undefined} />
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {sibling.owner?.nickname?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <p className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">
                              {sibling.owner?.nickname || '알 수 없음'}
                            </p>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                              sibling.status === 'available'
                                ? 'bg-green-500/15 text-green-600'
                                : 'bg-amber-500/15 text-amber-600'
                            }`}>
                              {sibling.status === 'available' ? '대여 가능' : '대여중'}
                            </span>
                            {sibling.status === 'available' && currentUserId && sibling.owner_id !== currentUserId && (
                              <button
                                className="text-[11px] px-2.5 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shrink-0"
                                onClick={() => onChat(sibling.owner_id, sibling.id, sibling.mode)}
                              >
                                요청
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                        {book.status === 'rented' ? (
                          /* Book is rented → show waitlist button */
                          <button
                            className={`btn-hip flex-1 flex items-center justify-center gap-2 ${isInWaitlist ? 'opacity-70' : ''}`}
                            onClick={handleWaitlist}
                            disabled={waitlistLoading}
                          >
                            {waitlistLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                            {isInWaitlist ? '대기 취소' : `대기 신청${waitlistCount > 0 ? ` (${waitlistCount}명)` : ''}`}
                          </button>
                        ) : (
                          /* Book is available → chat/request */
                          <button
                            className="btn-hip flex-1 flex items-center justify-center gap-2"
                            onClick={() => onChat(book.owner_id, book.id, book.mode)}
                          >
                            <MessageCircle className="w-4 h-4" />
                            {book.mode === 'rent' ? '대여 요청' : '구매 요청'}
                          </button>
                        )}
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
          </motion.div>
        )}
      </AnimatePresence>

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
  );
};
