import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
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
import { useBooks } from '@/hooks/useBooks';
import { useTransactions } from '@/hooks/useTransactions';
import { useCommunities } from '@/hooks/useCommunities';
import { useLikedBooks } from '@/hooks/useLikedBooks';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, Loader2, BookOpen, Heart, BookMarked, Search, X, MapPin, SlidersHorizontal } from 'lucide-react';

import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ShelfBook = Book & { _isBorrowed?: boolean; _isDummy?: boolean };
type ShelfGroup = { label?: string; books: ShelfBook[] };

const DUMMY_BOOKS: ShelfBook[] = [
  { id: 'dummy-1', title: '채식주의자', author: '한강', cover: null, status: 'available', mode: 'rent', owner_id: '', is_public: true, created_at: '', _isDummy: true } as ShelfBook,
  { id: 'dummy-2', title: '어린 왕자', author: '생텍쥐페리', cover: null, status: 'available', mode: 'rent', owner_id: '', is_public: true, created_at: '', _isDummy: true } as ShelfBook,
  { id: 'dummy-3', title: '데미안', author: '헤르만 헤세', cover: null, status: 'available', mode: 'rent', owner_id: '', is_public: true, created_at: '', _isDummy: true } as ShelfBook,
  { id: 'dummy-4', title: '1984', author: '조지 오웰', cover: null, status: 'available', mode: 'rent', owner_id: '', is_public: true, created_at: '', _isDummy: true } as ShelfBook,
  { id: 'dummy-5', title: '소년이 온다', author: '한강', cover: null, status: 'available', mode: 'rent', owner_id: '', is_public: true, created_at: '', _isDummy: true } as ShelfBook,
];
const DUMMY_THRESHOLD = 5;
type StatusFilter = 'all' | 'available' | 'rented';

interface BookshelfProps {
  onOpenChat: (userId: string, bookId: string, bookMode: 'rent' | 'sell') => void;
  initialCommunityId?: string | null;
  onCommunityFilterClear?: () => void;
}

type FilterType = 'everybody' | 'mine' | 'nearby' | string;

export const Bookshelf = ({ onOpenChat, initialCommunityId, onCommunityFilterClear }: BookshelfProps) => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('spine');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [previewBook, setPreviewBook] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>(initialCommunityId || 'everybody');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showLikedBooks, setShowLikedBooks] = useState(false);
  const [showTransactionDashboard, setShowTransactionDashboard] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'title' | 'author'>('newest');

  // Dynamic booksPerShelf based on container width
  const bookcaseRef = useRef<HTMLDivElement>(null);
  const [booksPerShelf, setBooksPerShelf] = useState(4);

  const calcBooksPerShelf = useCallback((contentWidth: number) => {
    // contentWidth = content-box width of the outer scroll container (inside px-6 padding)
    // On wide screens clamp to 520px so the shelf doesn't stretch beyond a readable width
    const effectiveWidth = Math.min(contentWidth, 520);
    // subtract: wood-texture p-4 (32px) + WoodenShelf inner p-4 (32px) = 64px
    const booksArea = effectiveWidth - 64;
    // book spine min-w-[40px] + gap-1 (4px) = 44px per slot
    const n = Math.max(2, Math.floor((booksArea + 4) / 44));
    setBooksPerShelf(n);
  }, []);

  useEffect(() => {
    const el = bookcaseRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      // contentRect.width is already the content-box width (excludes padding)
      if (entries[0]) calcBooksPerShelf(entries[0].contentRect.width);
    });
    ro.observe(el);
    // Initial: subtract element's own padding to get content-box width
    const s = getComputedStyle(el);
    calcBooksPerShelf(el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight));
    return () => ro.disconnect();
  }, [calcBooksPerShelf]);

  useEffect(() => {
    if (initialCommunityId) setActiveFilter(initialCommunityId);
  }, [initialCommunityId]);

  const { myCommunities } = useCommunities();
  const { books: allBooks, loading, error: booksError, deleteBook, updateBook, refresh } = useBooks({});

  const { containerRef: pullRef, refreshing: pullRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => { await refresh(); },
  });
  const {
    loading: txLoading,
    getLentBookIds,
    getLentBooksInfo,
    getRentedBooksInfo,
    getLentReturnDates,
    getBorrowedReturnDates,
  } = useTransactions();
  const { isLiked, toggleLike, likedBooks } = useLikedBooks();

  // Current user's district for nearby filter
  const [userDistrict, setUserDistrict] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    import('@/integrations/supabase/client').then(({ supabase }) => {
      supabase.from('profiles').select('district').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) setUserDistrict((data as any).district || null);
        });
    });
  }, [user?.id]);

  const getFilterLabel = () => {
    if (activeFilter === 'everybody') return '모두의 책장';
    if (activeFilter === 'mine') return '내 책장';
    if (activeFilter === 'nearby') return userDistrict ? `${userDistrict} 이웃 책장` : '이웃 책장';
    const community = myCommunities.find(c => c.id === activeFilter);
    return community?.name || '커뮤니티';
  };

  const lentBookIds = useMemo(() => getLentBookIds(), [getLentBookIds]);
  const lentBooksInfo = useMemo(() => getLentBooksInfo(), [getLentBooksInfo]);
  const lentReturnDates = useMemo(() => getLentReturnDates(), [getLentReturnDates]);
  const borrowedReturnDates = useMemo(() => getBorrowedReturnDates(), [getBorrowedReturnDates]);

  // Derived from useTransactions (same data source, single load)
  const borrowedBooksInfo = useMemo(() => getRentedBooksInfo(), [getRentedBooksInfo]);

  const rentedBookIds = useMemo(() => {
    return new Set(allBooks.filter(book => book.status === 'rented').map(book => book.id));
  }, [allBooks]);

  const applyStatusFilter = useCallback(<T extends Book>(books: T[]): T[] => {
    if (statusFilter === 'available') return books.filter(b => b.status === 'available');
    if (statusFilter === 'rented') return books.filter(b => b.status === 'rented');
    return books;
  }, [statusFilter]);

  const filteredBooks = useMemo(() => {
    let books = allBooks;

    if (activeFilter === 'mine') {
      books = books.filter(book => book.owner_id === user?.id);
    } else if (activeFilter === 'nearby') {
      if (userDistrict) {
        books = books.filter(book => (book.owner as any)?.district === userDistrict);
      }
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

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      books = books.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    }

    if (sortBy === 'title') books = [...books].sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === 'author') books = [...books].sort((a, b) => a.author.localeCompare(b.author));

    return applyStatusFilter(books);
  }, [allBooks, activeFilter, user?.id, myCommunities, searchQuery, sortBy, userDistrict, applyStatusFilter]);

  const myBooksSection = useMemo((): ShelfBook[] => {
    if (!user) return [];
    const owned: ShelfBook[] = allBooks.filter(b => b.owner_id === user.id);
    const ownedIds = new Set(owned.map(b => b.id));
    // Use getRentedBooksInfo (from useTransactions) so borrowed books are
    // determined from the same single fetch as everything else — no race condition
    const rentedInfo = getRentedBooksInfo();
    const borrowed: ShelfBook[] = allBooks
      .filter(b => rentedInfo.has(b.id) && !ownedIds.has(b.id))
      .map(b => ({ ...b, _isBorrowed: true } as ShelfBook));
    return applyStatusFilter([...owned, ...borrowed]);
  }, [allBooks, getRentedBooksInfo, user?.id, applyStatusFilter]);

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

  const communityBooks = useMemo((): ShelfBook[] => {
    if (activeFilter === 'mine') return [];
    // Exclude ALL user's books regardless of status filter — prevents books
    // from leaking into community section when statusFilter hides some owned books
    const allOwnedIds = new Set(allBooks.filter(b => b.owner_id === user?.id).map(b => b.id));
    const rentedInfo = getRentedBooksInfo();
    const books = filteredBooks.filter(
      b => !allOwnedIds.has(b.id) && !rentedInfo.has(b.id)
    ) as ShelfBook[];
    // Liked books bubble to the top-left of the community section
    return [...books].sort((a, b) => (isLiked(a.id) ? 0 : 1) - (isLiked(b.id) ? 0 : 1));
  }, [filteredBooks, allBooks, getRentedBooksInfo, user?.id, activeFilter, isLiked]);

  // Deduplicate community books by title+author — keep only the first occurrence per pair
  const { dedupedCommunityBooks, communityDuplicateCounts } = useMemo(() => {
    const seenKey = new Map<string, ShelfBook>();
    const counts = new Map<string, number>();
    for (const book of communityBooks) {
      const key = `${book.title.toLowerCase().trim()}|||${book.author.toLowerCase().trim()}`;
      if (!seenKey.has(key)) {
        seenKey.set(key, book);
        counts.set(book.id, 1);
      } else {
        const rep = seenKey.get(key)!;
        counts.set(rep.id, (counts.get(rep.id) ?? 1) + 1);
      }
    }
    return { dedupedCommunityBooks: [...seenKey.values()], communityDuplicateCounts: counts };
  }, [communityBooks]);

  // Dynamic shelf groups — books fill shelves continuously within each section
  const shelfGroups = useMemo((): ShelfGroup[] => {
    const groups: ShelfGroup[] = [];

    const addSection = (books: ShelfBook[], firstLabel?: string) => {
      books.forEach((book, i) => {
        if (i % booksPerShelf === 0) {
          groups.push({ label: i === 0 ? firstLabel : undefined, books: [] });
        }
        groups[groups.length - 1].books.push(book);
      });
    };

    const hasPersonal = user && filteredMySection.length > 0;
    const hasCommunity = activeFilter !== 'mine' && dedupedCommunityBooks.length > 0;

    if (hasPersonal) addSection(filteredMySection, hasCommunity ? '나의 책장' : undefined);
    if (hasCommunity) addSection(dedupedCommunityBooks, hasPersonal ? getFilterLabel() : undefined);

    // Fill with dummy books when everybody view has fewer than threshold real books
    const totalRealBooks = filteredMySection.length + dedupedCommunityBooks.length;
    const showDummy = activeFilter === 'everybody' && totalRealBooks < DUMMY_THRESHOLD && !searchQuery.trim();
    if (showDummy) {
      const needed = DUMMY_THRESHOLD - totalRealBooks;
      addSection(DUMMY_BOOKS.slice(0, needed));
    }

    return groups;
  }, [filteredMySection, dedupedCommunityBooks, activeFilter, user, booksPerShelf, getFilterLabel, searchQuery]);

  const totalRealBooks = filteredMySection.length + dedupedCommunityBooks.length;
  const showDummyBanner = activeFilter === 'everybody' && totalRealBooks < DUMMY_THRESHOLD && !searchQuery.trim();

  const emptyShelvesNeeded = Math.max(0, 3 - shelfGroups.length);

  const statusFilterLabels: Record<StatusFilter, string> = {
    all: '전체',
    available: '대여 가능',
    rented: '대여중',
  };

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (sortBy !== 'newest' ? 1 : 0) +
    (activeFilter === 'nearby' ? 1 : 0);

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <header className="flex flex-col gap-3 px-5 pt-4 pb-3 bg-background/85 backdrop-blur-md sticky top-0 z-30 border-b border-border/40">
        {/* Title block */}
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="eyebrow">{activeFilter === 'everybody' ? 'BOOKSHELF' : getFilterLabel()}</p>
            <h1 className="font-display text-[26px] font-medium leading-none tracking-tight text-foreground mt-1">
              {activeFilter === 'mine' ? '나의 서가' : activeFilter === 'everybody' ? '모두의 책장' : activeFilter === 'nearby' ? '이웃 서가' : getFilterLabel()}
            </h1>
          </div>
          {user && (
            <button
              onClick={() => setShowTransactionDashboard(true)}
              className="w-10 h-10 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center justify-center"
              title="거래 현황"
            >
              <BookMarked className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="제목 또는 저자 검색…"
            className="input-search"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between gap-2">
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />

          <div className="flex items-center gap-2">
            {/* Filter sheet trigger */}
            <button
              onClick={() => setShowFilterSheet(true)}
              className={`pill relative gap-1.5 ${activeFilterCount > 0 ? 'pill-active' : ''}`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>필터</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Bookshelf filter dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="pill max-w-[140px] justify-between">
                <span className="truncate">{getFilterLabel()}</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 bg-popover border border-border shadow-lg z-50">
                <DropdownMenuItem onClick={() => setActiveFilter('everybody')} className={activeFilter === 'everybody' ? 'bg-accent/15 text-foreground' : ''}>
                  모두의 책장
                </DropdownMenuItem>
                {user && (
                  <DropdownMenuItem onClick={() => setActiveFilter('mine')} className={activeFilter === 'mine' ? 'bg-accent/15 text-foreground' : ''}>
                    내 책장
                  </DropdownMenuItem>
                )}
                {user && userDistrict && (
                  <DropdownMenuItem onClick={() => setActiveFilter('nearby')} className={activeFilter === 'nearby' ? 'bg-accent/15 text-foreground' : ''}>
                    <MapPin className="w-3.5 h-3.5 mr-1.5" />
                    {userDistrict} 이웃 책장
                  </DropdownMenuItem>
                )}
                {myCommunities.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">내 커뮤니티</div>
                    {myCommunities.map(c => (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={() => setActiveFilter(c.id)}
                        className={activeFilter === c.id ? 'bg-accent/15 text-foreground' : ''}
                      >
                        {c.name}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Bookshelf Container — ref here so ResizeObserver is always active */}
      <div
        ref={(el) => {
          (bookcaseRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          (pullRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        className="flex-1 overflow-y-auto px-6 py-4"
      >
        {/* Pull-to-refresh indicator */}
        {(pullDistance > 0 || pullRefreshing) && (
          <div
            className="flex items-center justify-center text-muted-foreground"
            style={{ height: pullDistance || 44, transition: pullRefreshing ? 'none' : 'height 0.2s' }}
          >
            <Loader2 className={`w-5 h-5 ${pullRefreshing ? 'animate-spin text-primary' : 'opacity-50'}`} />
          </div>
        )}
        {booksError ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">책 목록을 불러오지 못했습니다</p>
              <p className="text-xs text-muted-foreground">네트워크 연결을 확인하고 다시 시도해주세요</p>
            </div>
            <button
              onClick={() => refresh()}
              className="pill pill-active gap-1.5"
            >
              <Loader2 className="w-3.5 h-3.5" />
              다시 시도
            </button>
          </div>
        ) : loading || txLoading ? (
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
                className="space-y-4 max-w-[520px] mx-auto w-full"
              >
                <div className="wood-texture rounded-xl p-4 shadow-shelf">
                  <div className="space-y-2">
                    {shelfGroups.map((group, idx) => (
                      <div key={idx}>
                        {group.label && (
                          <div className="section-divider">
                            <span className="section-divider-label">— {group.label}</span>
                            <span className="section-divider-rule" />
                          </div>
                        )}
                        <WoodenShelf>
                          <div className="flex items-end gap-1 h-[140px]">
                            {group.books.map(book => {
                              if (book._isDummy) {
                                return (
                                  <div
                                    key={book.id}
                                    className="opacity-30 pointer-events-none select-none"
                                    style={{ minWidth: 40 }}
                                  >
                                    <BookSpine book={book} onClick={() => {}} isSelected={false} isLent={false} isBorrowed={false} />
                                  </div>
                                );
                              }
                              const isLentBook = !book._isBorrowed && lentBookIds.has(book.id);
                              const isBorrowedBook = !!book._isBorrowed;
                              const retDate = isLentBook
                                ? lentReturnDates.get(book.id)
                                : isBorrowedBook
                                ? borrowedReturnDates.get(book.id)
                                : undefined;
                              return (
                                <BookSpine
                                  key={book.id}
                                  book={book}
                                  onClick={() => setSelectedBook(book)}
                                  isSelected={previewBook === book.id}
                                  isLent={isLentBook}
                                  isBorrowed={isBorrowedBook}
                                  borrowerNickname={lentBooksInfo.get(book.id)}
                                  lenderNickname={borrowedBooksInfo.get(book.id)}
                                  returnDate={retDate}
                                  duplicateCount={communityDuplicateCounts.get(book.id)}
                                />
                              );
                            })}
                          </div>
                        </WoodenShelf>
                      </div>
                    ))}

                    {Array.from({ length: emptyShelvesNeeded }).map((_, i) => (
                      <WoodenShelf key={`empty-${i}`} isEmpty>
                        <div className="h-[140px]" />
                      </WoodenShelf>
                    ))}
                  </div>
                </div>

                {/* Dummy books banner */}
                {showDummyBanner && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-4 mx-auto max-w-[520px] bg-primary/8 border border-primary/20 rounded-2xl px-5 py-4 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">예시 화면입니다</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        책이 5권 이상 쌓이면 예시 책들이 사라져요. 지금 첫 책을 등록해보세요!
                      </p>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="cover-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-[520px] mx-auto w-full"
              >
                {filteredMySection.length === 0 && dedupedCommunityBooks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <BookOpen className="w-16 h-16 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">아직 책이 없습니다</h3>
                    <p className="text-muted-foreground text-sm max-w-xs">
                      {activeFilter === 'mine'
                        ? '등록한 책이나 대여 중인 책이 없습니다.'
                        : activeFilter === 'nearby'
                        ? '근처 이웃의 책이 없습니다.'
                        : '책장이 비어있습니다. 책을 등록해보세요!'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {user && filteredMySection.length > 0 && (
                      <div>
                        {dedupedCommunityBooks.length > 0 && (
                          <p className="text-[11px] font-semibold text-muted-foreground/60 tracking-widest uppercase mb-3">나의 책장</p>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {filteredMySection.map((book, index) => (
                            <motion.div key={book.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
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

                    {activeFilter !== 'mine' && dedupedCommunityBooks.length > 0 && (
                      <div>
                        {user && filteredMySection.length > 0 && (
                          <p className="text-[11px] font-semibold text-muted-foreground/60 tracking-widest uppercase mb-3">{getFilterLabel()}</p>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {dedupedCommunityBooks.map((book, index) => {
                            const dupeCount = communityDuplicateCounts.get(book.id) ?? 1;
                            return (
                              <motion.div key={book.id} className="relative" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                                <BookCover book={book} onClick={() => setSelectedBook(book)} isRented={rentedBookIds.has(book.id)} isLent={lentBookIds.has(book.id)} />
                                {dupeCount > 1 && (
                                  <div className="absolute top-1.5 right-1.5 z-10 bg-white/85 text-foreground text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm leading-none pointer-events-none">
                                    ×{dupeCount}
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}
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

      {/* Heart FAB */}
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

      {/* Filter Dialog — positioned slightly above center */}
      <Dialog open={showFilterSheet} onOpenChange={setShowFilterSheet}>
        <DialogContent className="!top-[42%] w-[calc(100%-2rem)] max-w-sm rounded-2xl p-0 overflow-hidden max-h-[72vh] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle className="text-left text-base">필터 / 정렬</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {/* Sort */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">정렬</p>
              <div className="flex gap-2 flex-wrap">
                {(['newest', 'title', 'author'] as const).map(s => (
                  <button key={s} onClick={() => setSortBy(s)} className={`pill ${sortBy === s ? 'pill-active' : ''}`}>
                    {s === 'newest' ? '최신순' : s === 'title' ? '제목순' : '저자순'}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">책 상태</p>
              <div className="flex gap-2 flex-wrap">
                {(['all', 'available', 'rented'] as StatusFilter[]).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={`pill ${statusFilter === s ? 'pill-active' : ''}`}>
                    {statusFilterLabels[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* District */}
            {user && userDistrict && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">거주 지역</p>
                <button
                  onClick={() => setActiveFilter(activeFilter === 'nearby' ? 'everybody' : 'nearby')}
                  className={`pill gap-1.5 ${activeFilter === 'nearby' ? 'pill-active' : ''}`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {userDistrict} 이웃 책장
                </button>
              </div>
            )}

            {/* Reset */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setStatusFilter('all'); setSortBy('newest'); if (activeFilter === 'nearby') setActiveFilter('everybody'); }}
                className="text-xs text-muted-foreground underline underline-offset-2"
              >
                필터 초기화
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <TransactionDashboard isOpen={showTransactionDashboard} onClose={() => setShowTransactionDashboard(false)} />
      <LikedBooksPopup isOpen={showLikedBooks} onClose={() => setShowLikedBooks(false)} onBookClick={(book) => { setShowLikedBooks(false); setSelectedBook(book); }} />

      <BookDetailWithActions
        book={selectedBook}
        onClose={() => setSelectedBook(null)}
        onChat={onOpenChat}
        onEdit={(book) => { setSelectedBook(null); setEditingBook(book); }}
        onDelete={async (bookId) => {
          const { error } = await deleteBook(bookId);
          if (error) toast.error('책 삭제에 실패했습니다');
          else toast.success('책이 삭제되었습니다');
        }}
        isLiked={selectedBook ? isLiked(selectedBook.id) : false}
        onToggleLike={async (book) => {
          const { error } = await toggleLike(book.id);
          if (error) toast.error('업데이트에 실패했습니다');
        }}
        currentUserId={user?.id}
      />

      <EditBookModal
        book={editingBook}
        onClose={() => setEditingBook(null)}
        onSave={async (bookId, updates) => updateBook(bookId, updates)}
      />
    </div>
  );
};
