import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, BookOpen, Loader2 } from 'lucide-react';
import { useLikedBooks } from '@/hooks/useLikedBooks';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Book } from '@/types/book';
import { DefaultBookCover } from '@/components/DefaultBookCover';

interface LikedBooksPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onBookClick: (book: Book) => void;
}

export const LikedBooksPopup = ({ isOpen, onClose, onBookClick }: LikedBooksPopupProps) => {
  const { likedBooks, loading, unlikeBook, refresh } = useLikedBooks();

  // Re-fetch whenever popup opens so it stays in sync with heart button actions
  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen]);

  const handleUnlike = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    await unlikeBook(bookId);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="liked-books-backdrop"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Popup */}
          <motion.div
            key="liked-books-modal"
            className="w-[calc(100%-2rem)] max-w-sm h-fit box-border"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[70vh]">
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
                          {item.book?.cover && item.book.cover.length > 0 ? (
                            <img
                              src={item.book.cover}
                              alt={item.book.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <DefaultBookCover 
                              title={item.book?.title || ''} 
                              author={item.book?.author || ''} 
                              className="w-full h-full text-[8px]"
                            />
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
        </motion.div>
      )}
    </AnimatePresence>
  );
};
