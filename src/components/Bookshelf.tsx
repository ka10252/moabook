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
import { ChevronDown, Loader2, BookOpen, Heart, BookMarked, Search, X } from 'lucide-react';

import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

type ShelfBook = Book & { _isBorrowed?: boolean };
type ShelfGroup = { label?: string; books: ShelfBook[] };

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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'title' | 'author'>('newest');

  // Update filter when initialCommunityId changes
  useEffect(() => {
    if (initialCommunityId) {
      setActiveFilter(initialCommunityId);
    }
  }, [initialCommunityId]);

  const { myCommunities } = useCommunities();
  const { books: allBooks, loading, deleteBook, updateBook, refresh } = useBooks({});
  const { borrowedBooks } = useBorrowedBooks();
  const { getLentBookIds, getLentBooksInfo, getRentedBooksInfo } = useTransactions();
  const { isLiked, toggleLike, likedBooks } = useLikedBooks();

  const getFilterLabel = () => {
    if (activeFilter === 'everybody') return '모두의 책장';
    if (activeFilter === 'mine') return '내 책장';
    const community = myCommunities.find(c => c.id === activeFilter);
    return community?.name || '커뮤니티';
  };

  // Get lent book IDs from real transactions
  const lentBookIds = useMemo(() => getLentBookIds(), [getLentBookIds]);
  
  // Get lent books info with borrower nicknames
  const lentBooksInfo = useMemo(() => getLentBooksInfo(), [getLentBooksInfo]);

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

  const filteredBooks = useMemo(() => {
    let books = allBooks;

    // Community / owner filter
    if (activeFilter === 'mine') {
      books = books.filter(book => book.owner_id === user?.id);
    } else if (activeFilter !== 'everybody') {
      const isMyMemberOfCommunity = myCommunities.some(c => c.id === activeFilter);
      books = books.filter(book => {
        if (book.community_id === activeFilter) return true;
        if (isMyMemberOfCommunity && book.owner_id === user?.id) {
          return book.is_public || book.community_id === activeFilter;
        }
        return false;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      books = books.filter(
        b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'title') {
      books = [...books].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'author') {
      books = [...books].sort((a, b) => a.author.localeCompare(b.author));
    }
    // 'newest' is already the default order from DB

    return books;
  }, [allBooks, activeFilter, user?.id, myCommunities, searchQuery, sortBy]);

  const booksPerShelf = 4;

  // Personal section: owned books + books borrowed from others
  const myBooksSection = useMemo((): ShelfBook[] => {
    if (!user) return [];
    const owned: ShelfBook[] = allBooks.filter(b => b.owner_id === user.id);
    const ownedIds = new Set(owned.map(b => b.id));
    const borrowed: ShelfBook[] = borrowedBooks
      .filter(t => t.book && !ownedIds.has(t.book.id))
      .map(t => ({ ...t.book, _isBorrowed: true } as ShelfBook));
    return [...owned, ...borrowed];
  }, [allBooks, borrowedBooks, user?.id]);

  // Personal section with search + sort applied
  const filteredMySection = useMemo((): ShelfBook[] => {
    let books = myBooksSection;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      books = books.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    }
    if (sortBy === 'title') books = [...books].sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === 'author') books = [...books].sort((a, b) => a.author.localeCompare(b.author));
    return books;
  }, [myBooksSection, searchQuery, sortBy]);

  // Community books excluding the user's own section (to avoid duplication)
  const communityBooks = useMemo((): ShelfBook[] => {
    if (activeFilter === 'mine') return [];
    const myIds = new Set(myBooksSection.map(b => b.id));
    return filteredBooks.filter(b => !myIds.has(b.id)) as ShelfBook[];
  }, [filteredBooks, myBooksSection, activeFilter]);

  // Shelf groups for spine view: personal section first, then community
  const shelfGroups = useMemo((): ShelfGroup[] => {
    const groups: ShelfGroup[] = [];

    const addToGroups = (books: ShelfBook[], firstLabel?: string) => {
      books.forEach((book, i) => {
        if (i % booksPerShelf === 0) {
          groups.push({ label: i === 0 ? firstLabel : undefined, books: [] });
        }
        groups[groups.length - 1].books.push(book);
      });
    };

    const hasPersonal = user && filteredMySection.length > 0;
    const hasCommunity = activeFilter !== 'mine' && communityBooks.length > 0;

    if (hasPersonal) {
      addToGroups(filteredMySection, hasCommunity ? '나의 책장' : undefined);
    }
    if (hasCommunity) {
      addToGroups(communityBooks, hasPersonal ? getFilterLabel() : undefined);
    }

    return groups;
  }, [filteredMySection, communityBooks, activeFilter, user, booksPerShelf, getFilterLabel]);

  // Always show at least 3 total shelf rows
  const emptyShelvesNeeded = Math.max(0, 3 - shelfGroups.length);

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <header className="flex flex-col gap-2 px-4 py-3 bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        {/* Row 1: actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={() => setShowTransactionDashboard(true)}
                className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                title="거래 현황"
              >
                <BookMarked className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 px-3 py-2 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors">
                <span>{sortBy === 'newest' ? '최신순' : sortBy === 'title' ? '제목순' : '저자순'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32 bg-popover border border-border shadow-lg z-50">
                {(['newest', 'title', 'author'] as const).map(s => (
                  <DropdownMenuItem key={s} onClick={() => setSortBy(s)} className={sortBy === s ? 'bg-accent' : ''}>
                    {s === 'newest' ? '최신순' : s === 'title' ? '제목순' : '저자순'}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors max-w-[120px] justify-between">
                <span className="truncate">{getFilterLabel()}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover border border-border shadow-lg z-50">
                <DropdownMenuItem onClick={() => setActiveFilter('everybody')} className={activeFilter === 'everybody' ? 'bg-accent' : ''}>
                  모두의 책장
                </DropdownMenuItem>
                {user && (
                  <DropdownMenuItem onClick={() => setActiveFilter('mine')} className={activeFilter === 'mine' ? 'bg-accent' : ''}>
                    내 책장
                  </DropdownMenuItem>
                )}
                {myCommunities.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">내 커뮤니티</div>
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
        </div>

        {/* Row 2: Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="제목 또는 저자 검색..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
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
                    {/* Shelf groups: personal section first, then community */}
                    {shelfGroups.map((group, idx) => (
                      <div key={idx}>
                        {group.label && (
                          <p className="text-[11px] font-semibold text-muted-foreground/60 tracking-widest uppercase px-1 pb-1 pt-3 first:pt-0">
                            {group.label}
                          </p>
                        )}
                        <WoodenShelf>
                          <div className="flex items-end gap-1 h-[140px]">
                            {group.books.map(book => (
                              <BookSpine
                                key={book.id}
                                book={book}
                                onClick={() => setSelectedBook(book)}
                                isSelected={previewBook === book.id}
                                isLent={!book._isBorrowed && lentBookIds.has(book.id)}
                                isBorrowed={!!book._isBorrowed}
                                borrowerNickname={lentBooksInfo.get(book.id)}
                                lenderNickname={borrowedBooksInfo.get(book.id)}
                              />
                            ))}
                          </div>
                        </WoodenShelf>
                      </div>
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
                {filteredMySection.length === 0 && communityBooks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <BookOpen className="w-16 h-16 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">아직 책이 없습니다</h3>
                    <p className="text-muted-foreground text-sm max-w-xs">
                      {activeFilter === 'mine'
                        ? '등록한 책이나 대여 중인 책이 없습니다.'
                        : '책장이 비어있습니다. 책을 등록해보세요!'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Personal section */}
                    {user && filteredMySection.length > 0 && (
                      <div>
                        {communityBooks.length > 0 && (
                          <p className="text-[11px] font-semibold text-muted-foreground/60 tracking-widest uppercase mb-3">나의 책장</p>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {filteredMySection.map((book, index) => (
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
                                isLent={!book._isBorrowed && lentBookIds.has(book.id)}
                                isBorrowed={!!book._isBorrowed}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Community section */}
                    {activeFilter !== 'mine' && communityBooks.length > 0 && (
                      <div>
                        {user && filteredMySection.length > 0 && (
                          <p className="text-[11px] font-semibold text-muted-foreground/60 tracking-widest uppercase mb-3">{getFilterLabel()}</p>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {communityBooks.map((book, index) => (
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
                      </div>
                    )}
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
