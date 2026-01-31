import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WoodenShelf } from './WoodenShelf';
import { BookSpine } from './BookSpine';
import { BookCover } from './BookCover';
import { BookDetailWithActions } from './BookDetailWithActions';
import { EditBookModal } from './library/EditBookModal';
import { LikedBooksPopup } from './LikedBooksPopup';
import { ViewToggle, ViewMode } from './ViewToggle';
import { TransactionDashboard } from './transaction/TransactionDashboard';
import { Book } from '@/types/book';
import { useBooks, useBorrowedBooks } from '@/hooks/useBooks';
import { useTransactions } from '@/hooks/useTransactions';
import { useCommunities } from '@/hooks/useCommunities';
import { useLikedBooks } from '@/hooks/useLikedBooks';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, Loader2, BookOpen, Heart, BookMarked } from 'lucide-react';

import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface BookshelfProps {
  onOpenChat: (userId: string, bookId: string, bookMode: 'rent' | 'sell') => void;
  initialCommunityId?: string | null;
  onCommunityFilterClear?: () => void;
}

type FilterType = 'everybody' | 'mine' | string; // string for community IDs

export const Bookshelf = ({ onOpenChat, initialCommunityId, onCommunityFilterClear }: BookshelfProps) => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('spine');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [previewBook, setPreviewBook] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>(initialCommunityId || 'everybody');
  const [showLikedBooks, setShowLikedBooks] = useState(false);
  const [showTransactionDashboard, setShowTransactionDashboard] = useState(false);

  // Update filter when initialCommunityId changes
  useEffect(() => {
    if (initialCommunityId) {
      setActiveFilter(initialCommunityId);
    }
  }, [initialCommunityId]);

  const { myCommunities } = useCommunities();
  const { books: allBooks, loading, deleteBook, updateBook, refresh } = useBooks({});
  const { borrowedBooks } = useBorrowedBooks();
  const { getLentBookIds, getRentedBooksInfo } = useTransactions();
  const { isLiked, toggleLike, likedBooks } = useLikedBooks();

  // Get lent book IDs from real transactions
  const lentBookIds = useMemo(() => getLentBookIds(), [getLentBookIds]);

  // Get borrowed books info (books I borrowed from others)
  const borrowedBooksInfo = useMemo(() => {
    // Get from real borrowed books
    const realBorrowed = new Map(
      borrowedBooks
        .filter(t => t.book)
        .map(t => [t.book.id, t.book.owner?.nickname || 'Someone'])
    );
    
    // Merge with transaction hook data
    const rentedInfo = getRentedBooksInfo();
    rentedInfo.forEach((nickname, bookId) => {
      if (!realBorrowed.has(bookId)) {
        realBorrowed.set(bookId, nickname);
      }
    });
    
    return realBorrowed;
  }, [borrowedBooks, getRentedBooksInfo]);

  // Get rented book IDs (books that are currently rented out - status = 'rented')
  const rentedBookIds = useMemo(() => {
    return new Set(
      allBooks.filter(book => book.status === 'rented').map(book => book.id)
    );
  }, [allBooks]);

  // Filter books based on active filter
  // For community filter: show books from that community + my books if I'm a member
  const filteredBooks = useMemo(() => {
    const books = allBooks;
    
    if (activeFilter === 'mine') {
      return books.filter(book => book.owner_id === user?.id);
    } else if (activeFilter !== 'everybody') {
      // Filter by community - show:
      // 1. Books that belong to this community
      // 2. My own public books (if I'm a member of the community)
      const isMyMemberOfCommunity = myCommunities.some(c => c.id === activeFilter);
      return books.filter(book => {
        // Books specifically assigned to this community
        if (book.community_id === activeFilter) return true;
        // My books if I'm a member of this community (public or this community)
        if (isMyMemberOfCommunity && book.owner_id === user?.id) {
          return book.is_public || book.community_id === activeFilter;
        }
        return false;
      });
    }
    
    return books;
  }, [allBooks, activeFilter, user?.id, myCommunities]);

  // Organize books: user's books first in "everybody's" or community views
  const organizedBooks = useMemo(() => {
    if (!user || activeFilter === 'mine') {
      return filteredBooks;
    }
    
    const myBooks = filteredBooks.filter(book => book.owner_id === user.id);
    const otherBooks = filteredBooks.filter(book => book.owner_id !== user.id);
    
    return [...myBooks, ...otherBooks];
  }, [filteredBooks, user, activeFilter]);

  // Split books into shelf rows (4 books per shelf for spine view)
  const booksPerShelf = 4;
  const shelves: Book[][] = [];
  for (let i = 0; i < organizedBooks.length; i += booksPerShelf) {
    shelves.push(organizedBooks.slice(i, i + booksPerShelf));
  }

  // Always show at least 3 empty shelves
  const minShelves = 3;
  const emptyShelvesNeeded = Math.max(0, minShelves - shelves.length);

  const getFilterLabel = () => {
    if (activeFilter === 'everybody') return '모두의 책장';
    if (activeFilter === 'mine') return '내 책장';
    const community = myCommunities.find(c => c.id === activeFilter);
    return community?.name || '커뮤니티';
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 bg-card/80 backdrop-blur-sm sticky top-0 z-30 gap-2">
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Transaction Dashboard Button */}
          {user && (
            <button
              onClick={() => setShowTransactionDashboard(true)}
              className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors flex-shrink-0"
              title="거래 현황"
            >
              <BookMarked className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors min-w-[120px] justify-between flex-shrink-0">
              <span className="truncate">{getFilterLabel()}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover border border-border shadow-lg z-50">
              <DropdownMenuItem 
                onClick={() => setActiveFilter('everybody')}
                className={activeFilter === 'everybody' ? 'bg-accent' : ''}
              >
                모두의 책장
              </DropdownMenuItem>
              {user && (
                <DropdownMenuItem 
                  onClick={() => setActiveFilter('mine')}
                  className={activeFilter === 'mine' ? 'bg-accent' : ''}
                >
                  내 책장
                </DropdownMenuItem>
              )}
              {myCommunities.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    내 커뮤니티
                  </div>
                  {myCommunities.map(community => (
                    <DropdownMenuItem 
                      key={community.id}
                      onClick={() => setActiveFilter(community.id)}
                      className={activeFilter === community.id ? 'bg-accent' : ''}
                    >
                      {community.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Bookshelf Container */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === 'spine' ? (
              <motion.div
                key="spine-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Wooden bookcase frame */}
                <div className="wood-texture rounded-lg p-4 shadow-shelf">
                  <div className="space-y-2">
                    {/* Shelves with books */}
                    {shelves.map((shelfBooks, shelfIndex) => (
                      <WoodenShelf key={shelfIndex}>
                        <div className="flex items-end gap-1 h-[140px]">
                        {shelfBooks.map((book) => (
                            <BookSpine
                              key={book.id}
                              book={book}
                              onClick={() => setSelectedBook(book)}
                              isSelected={previewBook === book.id}
                              isLent={lentBookIds.has(book.id)}
                              isBorrowed={borrowedBooksInfo.has(book.id)}
                              isRented={rentedBookIds.has(book.id)}
                              lenderNickname={borrowedBooksInfo.get(book.id)}
                            />
                          ))}
                        </div>
                      </WoodenShelf>
                    ))}
                    
                    {/* Empty shelves to maintain structure */}
                    {Array.from({ length: emptyShelvesNeeded }).map((_, i) => (
                      <WoodenShelf key={`empty-${i}`} isEmpty>
                        <div className="h-[140px]" />
                      </WoodenShelf>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="cover-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {organizedBooks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <BookOpen className="w-16 h-16 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">아직 책이 없습니다</h3>
                    <p className="text-muted-foreground text-sm max-w-xs">
                      {activeFilter === 'mine' 
                        ? '아직 등록한 책이 없습니다.'
                        : '책장이 비어있습니다. 책을 등록해보세요!'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {organizedBooks.map((book, index) => (
                      <motion.div
                        key={book.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <BookCover
                          book={book}
                          onClick={() => setSelectedBook(book)}
                          isRented={rentedBookIds.has(book.id)}
                          isLent={lentBookIds.has(book.id)}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Heart FAB - shows liked books count */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        onClick={() => setShowLikedBooks(true)}
      >
        <Heart className="w-6 h-6" />
        {likedBooks.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
            {likedBooks.length}
          </span>
        )}
      </motion.button>

      {/* Transaction Dashboard */}
      <TransactionDashboard
        isOpen={showTransactionDashboard}
        onClose={() => setShowTransactionDashboard(false)}
      />

      {/* Liked Books Popup */}
      <LikedBooksPopup
        isOpen={showLikedBooks}
        onClose={() => setShowLikedBooks(false)}
        onBookClick={(book) => {
          setShowLikedBooks(false);
          setSelectedBook(book);
        }}
      />

      {/* Book Detail Modal with Edit/Delete */}
      <BookDetailWithActions 
        book={selectedBook} 
        onClose={() => setSelectedBook(null)} 
        onChat={onOpenChat}
        onEdit={(book) => {
          setSelectedBook(null);
          setEditingBook(book);
        }}
        onDelete={async (bookId) => {
          const { error } = await deleteBook(bookId);
          if (error) {
            toast.error('책 삭제에 실패했습니다');
          } else {
            toast.success('책이 삭제되었습니다');
          }
        }}
        isLiked={selectedBook ? isLiked(selectedBook.id) : false}
        onToggleLike={async (book) => {
          const { error } = await toggleLike(book.id);
          if (error) {
            toast.error('업데이트에 실패했습니다');
          }
        }}
        currentUserId={user?.id}
      />

      {/* Edit Modal */}
      <EditBookModal
        book={editingBook}
        onClose={() => setEditingBook(null)}
        onSave={async (bookId, updates) => {
          const result = await updateBook(bookId, updates);
          return result;
        }}
      />
    </div>
  );
};
