import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, BookOpen, Loader2 } from 'lucide-react';
import { useLikedBooks } from '@/hooks/useLikedBooks';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Book } from '@/types/book';

interface LikedBooksPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onBookClick: (book: Book) => void;
}

export const LikedBooksPopup = ({ isOpen, onClose, onBookClick }: LikedBooksPopupProps) => {
  const { likedBooks, loading, unlikeBook } = useLikedBooks();

  const handleUnlike = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    await unlikeBook(bookId);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Popup */}
          <motion.div
            className="fixed inset-x-4 bottom-24 md:inset-x-auto md:right-4 md:bottom-24 md:w-80 z-50"
            style={{ maxHeight: '60vh' }}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="bg-card rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[60vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary fill-primary" />
                  <h3 className="font-bold text-foreground">관심 도서</h3>
                  <span className="text-sm text-muted-foreground">({likedBooks.length})</span>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <ScrollArea className="flex-1 min-h-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : likedBooks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <BookOpen className="w-12 h-12 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">
                      아직 관심 도서가 없습니다
                    </p>
                    <p className="text-muted-foreground/70 text-xs mt-1">
                      책 상세에서 하트를 눌러 추가해보세요
                    </p>
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {likedBooks.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors group"
                        onClick={() => item.book && onBookClick(item.book)}
                      >
                        {/* Book cover */}
                        <div className="w-12 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {item.book?.cover ? (
                            <img
                              src={item.book.cover}
                              alt={item.book.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Book info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">
                            {item.book?.title || '알 수 없음'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.book?.author || ''}
                          </p>
                          <p className="text-xs text-primary mt-0.5">
                            {item.book?.mode === 'rent' ? '대여' : `₩${item.book?.price?.toLocaleString()}`}
                          </p>
                        </div>

                        {/* Unlike button */}
                        <button
                          onClick={(e) => handleUnlike(e, item.book_id)}
                          className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                        >
                          <Heart className="w-4 h-4 text-primary fill-primary" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
