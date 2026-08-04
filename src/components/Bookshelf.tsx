import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { track } from '@/lib/analytics';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { motion, AnimatePresence } from 'framer-motion';
import { EditorialShelf } from './EditorialShelf';
import { BookSpine } from './BookSpine';
import { BookDetailWithActions } from './BookDetailWithActions';
import { EditBookModal } from './library/EditBookModal';
import { LikedBooksPopup } from './LikedBooksPopup';
import { TransactionDashboard } from './transaction/TransactionDashboard';
import { Book } from '@/types/book';
import { useBooks } from '@/hooks/useBooks';
import { useTransactions } from '@/hooks/useTransactions';
import { useCommunities } from '@/hooks/useCommunities';
import { useLikedBooks } from '@/hooks/useLikedBooks';
import { useAuth } from '@/hooks/useAuth';
import { useGuestGate } from '@/hooks/useGuestGate';
import { useBackClose } from '@/hooks/useBackClose';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, Loader2, BookOpen, Heart, History, Search, X, MapPin, SlidersHorizontal, LayoutGrid, GalleryVerticalEnd } from 'lucide-react';
import { BookCover } from './BookCover';

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
import { BookMode } from '@/lib/bookMode';

type ShelfBook = Book & { _isBorrowed?: boolean; _isDummy?: boolean };
type ShelfGroup = { label?: string; books: ShelfBook[] };

const DUMMY_BOOKS: ShelfBook[] = [
  { id: 'dummy-1', title: '채식주의자', author: '한강', cover: null, status: 'available', mode: 'rent', owner_id: '', is_public: true, created_at: '', _isDummy: true } as ShelfBook,
  { id: 'dummy-2', title: '어린 왕자', author: '생텍쥐페리', cover: null, status: 'available', mode: 'rent', owner_id: '', is_public: true, created_at: '', _isDummy: true } as ShelfBook,
  { id: 'dummy-3', title: '데미안', author: '헤르만 헤세', cover: null, status: 'available', mode: 'rent', owner_id: '', is_public: true, created_at: '', _isDummy: true } as ShelfBook,
  { id: 'dummy-4', title: '1984', author: '조지 오웰', cover: null, status: 'available', mode: 'rent', owner_id: '', is_public: true, created_at: '', _isDummy: true } as ShelfBook,
  { id: 'dummy-5', title: '소년이 온다', author: '한강', cover: null, status: 'available', mode: 'rent', owner_id: '', is_public: true, created_at: '', _isDummy: true } as ShelfBook,
  // 긴 제목이 책등에서 어떻게 잘리는지(말줄임) 실제로 확인할 수 있는 표본
  { id: 'dummy-6', title: '아주 긴 제목의 책은 책등에서 어떻게 보이는가에 관한 연구', author: '김서연', cover: null, status: 'available', mode: 'rent', owner_id: '', is_public: true, created_at: '', _isDummy: true } as ShelfBook,
];
const DUMMY_THRESHOLD = 6;
type StatusFilter = 'all' | 'available' | 'giving' | 'selling' | 'rented';

/** 예시 책은 아무 조건도 안 건 기본 화면(모두의 책장 · 전체 · 검색어 없음)에서만 채운다 */
const canShowDummy = (
  activeFilter: string,
  statusFilter: StatusFilter,
  searchQuery: string,
  realCount: number
) =>
  activeFilter === 'everybody' &&
  statusFilter === 'all' &&
  !searchQuery.trim() &&
  realCount < DUMMY_THRESHOLD;

interface BookshelfProps {
  onOpenChat: (userId: string, bookId: string, bookMode: BookMode) => void;
  initialCommunityId?: string | null;
  onCommunityFilterClear?: () => void;
  /** 알림에서 넘어온 딥링크 — 이 책의 상세를 연다 */
  openBookId?: string | null;
  /** 알림에서 넘어온 딥링크 — 거래 현황을 연다 */
  openTransactions?: boolean;
  /** 딥링크를 소비한 뒤 URL에서 지우도록 알린다 (뒤로가기가 같은 화면을 반복해 열지 않게) */
  onDeepLinkConsumed?: () => void;
}

type FilterType = 'everybody' | 'mine' | string;

export const Bookshelf = ({
  onOpenChat,
  initialCommunityId,
  onCommunityFilterClear,
  openBookId,
  openTransactions,
  onDeepLinkConsumed,
}: BookshelfProps) => {
  const { user } = useAuth();
  const { isGuest, trackBrowse, requireAuth } = useGuestGate();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [previewBook, setPreviewBook] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>(initialCommunityId || 'everybody');
  // 커뮤니티 책장: 그 커뮤니티 멤버들의 user_id (멤버의 공개책도 책장에 노출하기 위함)
  const [communityMemberIds, setCommunityMemberIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (activeFilter === 'everybody' || activeFilter === 'mine') { setCommunityMemberIds(new Set()); return; }
    let cancelled = false;
    supabase
      .from('community_members')
      .select('user_id')
      .eq('community_id', activeFilter)
      .eq('is_banned', false)
      .then(({ data }) => {
        if (!cancelled) setCommunityMemberIds(new Set((data ?? []).map((r) => (r as { user_id: string }).user_id)));
      });
    return () => { cancelled = true; };
  }, [activeFilter]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);
  const [showLikedBooks, setShowLikedBooks] = useState(false);
  const [showTransactionDashboard, setShowTransactionDashboard] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // 뒤로가기는 "떠 있는 것부터" 닫는다 — 모달을 둔 채 뒤 페이지만 넘어가지 않도록.
  useBackClose(!!selectedBook, () => setSelectedBook(null));
  useBackClose(!!editingBook, () => setEditingBook(null));
  useBackClose(showFilterSheet, () => setShowFilterSheet(false));
  useBackClose(showLikedBooks, () => setShowLikedBooks(false));
  useBackClose(showTransactionDashboard, () => setShowTransactionDashboard(false));
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'title' | 'author'>('newest');

  // Dynamic booksPerShelf based on container width
  const bookcaseRef = useRef<HTMLDivElement>(null);
  const [booksPerShelf, setBooksPerShelf] = useState(4);
  // 책등(spine) ↔ 표지(cover) 보기 모드
  const [viewMode, setViewMode] = useState<'spine' | 'cover'>(() => {
    try { return (localStorage.getItem('moa_shelf_view') as 'spine' | 'cover') || 'spine'; } catch { return 'spine'; }
  });
  const toggleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === 'spine' ? 'cover' : 'spine';
      try { localStorage.setItem('moa_shelf_view', next); } catch { /* ignore */ }
      return next;
    });
  };

  const calcBooksPerShelf = useCallback((contentWidth: number) => {
    // contentWidth = content-box width of the outer scroll container (inside px-6 padding)
    // On wide screens clamp to 520px so the shelf doesn't stretch beyond a readable width
    // EditorialShelf(시안 F) 뒷판은 좌우 px-3(=24px) 패딩이 있다 → 예산에서 뺀다.
    const effectiveWidth = Math.min(contentWidth, 520) - 24;
    // 책등 max-w 52px + gap 6px = 슬롯당 58px
    const n = Math.max(2, Math.floor((effectiveWidth + 6) / 58));
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

  // 알림 딥링크 — 거래 현황 열기
  useEffect(() => {
    if (!openTransactions) return;
    setShowTransactionDashboard(true);
    onDeepLinkConsumed?.();
  }, [openTransactions]);

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
    getMyBorrowCount,
  } = useTransactions();
  const { isLiked, toggleLike, likedBooks } = useLikedBooks();

  /**
   * 알림 딥링크 — 특정 책의 상세를 연다.
   * 책 목록이 아직 로딩 중일 수 있어, 목록이 채워진 뒤에 찾는다.
   * 못 찾으면(비공개·삭제됨) 조용히 넘기지 않고 이유를 알린다 — 알림을 눌렀는데
   * 아무 반응이 없으면 유저는 앱이 고장났다고 생각한다.
   */
  useEffect(() => {
    if (!openBookId || loading) return;
    const found = allBooks.find((b) => b.id === openBookId);
    if (found) {
      setSelectedBook(found);
    } else {
      toast.info('이 책은 더 이상 볼 수 없어요 (삭제되었거나 비공개 책입니다)');
    }
    onDeepLinkConsumed?.();
  }, [openBookId, loading, allBooks]);

  // Singapore planning areas — service region is SG only
  useEffect(() => {
    setAvailableDistricts([
      'Ang Mo Kio', 'Bedok', 'Bishan', 'Bukit Batok', 'Bukit Merah',
      'Bukit Panjang', 'Bukit Timah', 'Choa Chu Kang', 'Clementi',
      'Geylang', 'Hougang', 'Jurong East', 'Jurong West', 'Kallang',
      'Marine Parade', 'Novena', 'Pasir Ris', 'Punggol', 'Queenstown',
      'Sembawang', 'Sengkang', 'Serangoon', 'Tampines', 'Tanglin',
      'Toa Payoh', 'Woodlands', 'Yishun',
    ]);
  }, []);

  const getFilterLabel = () => {
    if (activeFilter === 'everybody') return '모두의 책장';
    if (activeFilter === 'mine') return '내 책장';
    const community = myCommunities.find(c => c.id === activeFilter);
    return community?.name || '커뮤니티';
  };

  const lentBookIds = useMemo(() => getLentBookIds(), [getLentBookIds]);
  const lentBooksInfo = useMemo(() => getLentBooksInfo(), [getLentBooksInfo]);
  const lentReturnDates = useMemo(() => getLentReturnDates(), [getLentReturnDates]);
  const borrowedReturnDates = useMemo(() => getBorrowedReturnDates(), [getBorrowedReturnDates]);

  // Derived from useTransactions (same data source, single load)
  const borrowedBooksInfo = useMemo(() => getRentedBooksInfo(), [getRentedBooksInfo]);


  const applyStatusFilter = useCallback(<T extends Book>(books: T[]): T[] => {
    if (statusFilter === 'available') return books.filter(b => b.status === 'available' && b.allowRent);
    if (statusFilter === 'giving') return books.filter(b => b.status === 'available' && b.allowGive);
    if (statusFilter === 'selling') return books.filter(b => b.allowSell);
    if (statusFilter === 'rented') return books.filter(b => b.status === 'rented');
    return books;
  }, [statusFilter]);

  /**
   * 책장 정렬 규칙 (우선순위 순):
   *  1) 대여중인 책은 항상 맨 뒤 — 지금 빌릴 수 없으니 시선을 뺏으면 안 된다
   *  2) 사용자가 고른 정렬 (제목/저자)
   *  3) 기본은 최신 등록순 — 새로 올라온 책이 맨 앞(왼쪽 위)
   */
  const sortShelfBooks = useCallback(<T extends Book>(books: T[]): T[] => {
    return [...books].sort((a, b) => {
      const aOut = a.status === 'rented' ? 1 : 0;
      const bOut = b.status === 'rented' ? 1 : 0;
      if (aOut !== bOut) return aOut - bOut;

      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'author') return a.author.localeCompare(b.author);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [sortBy]);

  const filteredBooks = useMemo(() => {
    let books = allBooks;

    if (activeFilter === 'mine') {
      books = books.filter(book => book.owner_id === user?.id);
    } else if (activeFilter !== 'everybody') {
      // 커뮤니티 책장 = ① 그 커뮤니티에 지정된 책(커뮤니티 전용 포함) + ② 커뮤니티 멤버들의 공개책
      //   커뮤니티 전용(공개범위 제한) 책은 그 커뮤니티에서만 보이고, 공개책은 멤버라면 자동 노출.
      books = books.filter(book => {
        if (book.community_id === activeFilter) return true;
        if (book.is_public && communityMemberIds.has(book.owner_id)) return true;
        return false;
      });
    }

    if (selectedDistricts.length > 0) {
      books = books.filter(book => {
        const d = (book.owner as any)?.district;
        return d && selectedDistricts.includes(d);
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      books = books.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    }

    return sortShelfBooks(applyStatusFilter(books));
  }, [allBooks, activeFilter, user?.id, communityMemberIds, selectedDistricts, searchQuery, sortShelfBooks, applyStatusFilter]);

  // 검색 로그는 타이핑 중이 아니라 "멈춘 뒤"에 한 번만 남긴다.
  // 글자마다 찍으면 "책"을 치는 동안 ㅊ,채,책 3번이 남아 노이즈가 된다.
  // 결과 0건은 공급 부족의 가장 직접적인 신호라 따로 표시한다.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;
    const timer = setTimeout(() => {
      const count = filteredBooks.length;
      track('search_performed', { query: q, result_count: count });
      if (count === 0) track('search_no_result', { query: q });
    }, 900);
    return () => clearTimeout(timer);
  }, [searchQuery, filteredBooks]);

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
    return sortShelfBooks(books);
  }, [myBooksSection, searchQuery, sortShelfBooks]);

  const communityBooks = useMemo((): ShelfBook[] => {
    if (activeFilter === 'mine') return [];
    // Exclude ALL user's books regardless of status filter — prevents books
    // from leaking into community section when statusFilter hides some owned books
    const allOwnedIds = new Set(allBooks.filter(b => b.owner_id === user?.id).map(b => b.id));
    const rentedInfo = getRentedBooksInfo();
    const books = filteredBooks.filter(
      b => !allOwnedIds.has(b.id) && !rentedInfo.has(b.id)
    ) as ShelfBook[];
    // 대여중은 항상 맨 뒤 → 그 다음 좋아요한 책이 앞으로 → 나머지는 기존 정렬(최신순) 유지
    return [...books].sort((a, b) => {
      const aOut = a.status === 'rented' ? 1 : 0;
      const bOut = b.status === 'rented' ? 1 : 0;
      if (aOut !== bOut) return aOut - bOut;
      return (isLiked(a.id) ? 0 : 1) - (isLiked(b.id) ? 0 : 1);
    });
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

    if (hasPersonal) {
      // 내 서가를 방향(내 책 / 빌려준 책 / 빌린 책)으로 칸막이 구분한다.
      //  - 빌린 책: 남의 책을 내가 빌림(_isBorrowed)
      //  - 빌려준 책: 내 책이 지금 나가 있음(lentBookIds)
      //  - 내 책: 그 외 내가 가진 책
      const own      = filteredMySection.filter(b => !b._isBorrowed && !lentBookIds.has(b.id));
      const lent     = filteredMySection.filter(b => !b._isBorrowed &&  lentBookIds.has(b.id));
      const borrowed = filteredMySection.filter(b =>  b._isBorrowed);

      // 카테고리가 둘 이상이거나 커뮤니티 책장이 함께 뜰 때만 라벨을 붙인다.
      // 한 종류뿐이면 굳이 나누지 않고 깔끔하게.
      const nonEmpty = [own, lent, borrowed].filter(a => a.length > 0).length;
      const labelize = nonEmpty > 1 || hasCommunity;

      if (own.length)      addSection(own,      labelize ? '내 책'      : undefined);
      if (lent.length)     addSection(lent,     labelize ? '빌려준 책'  : undefined);
      if (borrowed.length) addSection(borrowed, labelize ? '빌린 책'    : undefined);
    }
    if (hasCommunity) addSection(dedupedCommunityBooks, hasPersonal ? getFilterLabel() : undefined);

    // 예시 책은 "아직 책이 없는 새 책장"을 덜 휑하게 보이려고 두는 것이다.
    // 필터·검색으로 결과가 줄어든 건 빈 책장이 아니라 "조건에 맞는 책이 그것뿐"인 상태다.
    // 거기에 예시 책을 채우면 필터가 고장난 것처럼 보인다 — 그래서 기본 화면에서만 채운다.
    const totalRealBooks = filteredMySection.length + dedupedCommunityBooks.length;
    if (canShowDummy(activeFilter, statusFilter, searchQuery, totalRealBooks)) {
      addSection(DUMMY_BOOKS.slice(0, DUMMY_THRESHOLD - totalRealBooks));
    }

    return groups;
  }, [filteredMySection, dedupedCommunityBooks, activeFilter, statusFilter, user, booksPerShelf, getFilterLabel, searchQuery, lentBookIds]);

  const totalRealBooks = filteredMySection.length + dedupedCommunityBooks.length;
  const showDummyBanner = canShowDummy(activeFilter, statusFilter, searchQuery, totalRealBooks);

  // 필터·검색을 걸었는데 0건이면 빈 서가만 보여선 안 된다 — 왜 비었는지 알려준다.
  const hasActiveQuery =
    searchQuery.trim() !== '' || statusFilter !== 'all' || selectedDistricts.length > 0;
  const showNoResults = totalRealBooks === 0 && hasActiveQuery && !showDummyBanner;

  // 결과 없음 안내를 띄울 땐 장식용 빈 서가 필러를 숨겨 메시지가 붕 뜨지 않게 한다.
  const emptyShelvesNeeded = showNoResults ? 1 : Math.max(0, 3 - shelfGroups.length);

  const statusFilterLabels: Record<StatusFilter, string> = {
    all: '전체',
    available: '대여 가능',
    giving: '나눔',
    selling: '판매중',
    rented: '대여중',
  };

  // 상태 필터는 헤더 칩으로 눈에 보이므로 뱃지에서 세지 않는다.
  // 뱃지는 "시트 안에 숨어 있는 필터가 몇 개 켜져 있나"만 알려야 한다.
  const activeFilterCount =
    (sortBy !== 'newest' ? 1 : 0) +
    (selectedDistricts.length > 0 ? 1 : 0);

  return (
    <div className="flex flex-col min-h-full relative">
      {/* Header — 페이지 스크롤 시 상단(앱 헤더 아래)에 고정 */}
      <header className="flex flex-col gap-3 px-5 pt-4 pb-3 bg-background/85 backdrop-blur-md sticky top-14 z-30 border-b border-border/40">
        {/* Title block — 제목 자체가 '책장 범위' 선택기다.
            예전엔 제목과 드롭다운이 같은 값을 두 번 보여줬다(중복). 제목을 컨트롤로 만들면
            드롭다운이 컨트롤 줄에서 빠지고, 그 자리를 상태 칩이 쓴다 → 줄 수는 그대로. */}
        <div className="flex items-end justify-between gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="group text-left outline-none">
              <p className="eyebrow">BOOKSHELF</p>
              <h1 className="font-display text-[26px] leading-none text-foreground mt-1 flex items-center gap-1.5">
                <span className="truncate max-w-[220px]">
                  {activeFilter === 'mine' ? '나의 서가' : activeFilter === 'everybody' ? '모두의 책장' : getFilterLabel()}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-180" />
              </h1>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 bg-popover border border-border shadow-lg z-50">
              <DropdownMenuItem onClick={() => setActiveFilter('everybody')} className={activeFilter === 'everybody' ? 'bg-accent/15 text-foreground' : ''}>
                모두의 책장
              </DropdownMenuItem>
              {user && (
                <DropdownMenuItem onClick={() => setActiveFilter('mine')} className={activeFilter === 'mine' ? 'bg-accent/15 text-foreground' : ''}>
                  나의 서가
                </DropdownMenuItem>
              )}
              {myCommunities.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-[12px] uppercase tracking-widest text-muted-foreground font-bold">내 커뮤니티</div>
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

          {user && (
            <button
              onClick={() => { if (requireAuth()) setShowTransactionDashboard(true); }}
              className="w-10 h-10 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center justify-center shrink-0"
              title="거래 현황"
            >
              <History className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>

        {/* Search — 밑줄 스타일 (프로토타입 1a) */}
        <div className="search-underline">
          <Search className="w-[17px] h-[17px] text-foreground shrink-0" strokeWidth={1.75} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="제목 또는 저자 검색"
            className="input-search"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="shrink-0" aria-label="검색어 지우기">
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          )}
        </div>

        {/* Controls row — 한 줄 유지.
            자주 쓰는 상태 필터는 노출하고, 가끔 쓰는 정밀 필터(지역·정렬)와 뷰 전환은
            아이콘으로 접어 오른쪽 끝에 고정한다. */}
        <div className="flex items-center gap-2">
          {/* 상태 칩 — 넘치면 가로 스크롤 */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
            {/* '대여중'은 칩에서 뺐다 — 대여중인 책은 어차피 서가 맨 뒤에 비활성으로 보인다 */}
            {(['all', 'available', 'giving', 'selling'] as StatusFilter[]).map((key) => (
              { key, label: statusFilterLabels[key] }
            )).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`chip ${statusFilter === key ? 'chip-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 책등 ↔ 표지 보기 전환 */}
          <button
            onClick={toggleViewMode}
            className="w-9 h-9 shrink-0 rounded-full border border-border text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            aria-label={viewMode === 'spine' ? '표지로 보기' : '책등으로 보기'}
            title={viewMode === 'spine' ? '표지로 보기' : '책등으로 보기'}
          >
            {viewMode === 'spine'
              ? <LayoutGrid className="w-4 h-4" />
              : <GalleryVerticalEnd className="w-4 h-4" />}
          </button>

          {/* 정밀 필터 (지역·정렬) */}
          <button
            onClick={() => setShowFilterSheet(true)}
            className={`relative w-9 h-9 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
              activeFilterCount > 0
                ? 'border-primary text-primary bg-primary/10'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
            aria-label="상세 필터"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[12px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Bookshelf Container — ref here so ResizeObserver is always active */}
      <div
        ref={(el) => {
          (bookcaseRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          (pullRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        className="flex-1 px-6 py-4"
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
          <motion.div
                key="spine-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4 max-w-[520px] mx-auto w-full"
              >
                {/* shelf-vignette: 가상 도서관 몰입감 — 서가 가장자리를 은은히 어둡게 */}
                {/* data-onboarding: 온보딩 스포트라이트가 실제 서가를 조준한다 */}
                <div data-onboarding="shelf" className={viewMode === 'cover' ? 'relative' : 'relative shelf-vignette space-y-3'}>
                  {viewMode === 'cover' ? (
                    shelfGroups.map((group, idx) => (
                      <div key={idx} className="mb-5">
                        {group.label && <p className="font-display italic text-[16px] text-foreground mb-2">{group.label}</p>}
                        <div className="grid grid-cols-3 gap-x-3 gap-y-5">
                          {group.books.filter((b) => !b._isDummy).map((book) => (
                            <BookCover
                              key={book.id}
                              book={book}
                              onClick={() => { trackBrowse(); track('book_viewed', { book_id: book.id, from: 'shelf' }); setSelectedBook(book); }}
                              isRented={book.status === 'rented'}
                              isLent={!book._isBorrowed && lentBookIds.has(book.id)}
                              isBorrowed={!!book._isBorrowed}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                  {shelfGroups.map((group, idx) => (
                    <EditorialShelf key={idx} label={group.label || undefined}>
                      {group.books.map(book => {
                        if (book._isDummy) {
                          return (
                            <div
                              key={book.id}
                              className="opacity-30 pointer-events-none select-none flex-1 min-w-[26px] max-w-[52px] h-full flex items-end"
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
                            onClick={() => { trackBrowse(); track('book_viewed', { book_id: book.id, from: 'shelf' }); setSelectedBook(book); }}
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
                    </EditorialShelf>
                  ))}

                  {Array.from({ length: emptyShelvesNeeded }).map((_, i) => (
                    <EditorialShelf key={`empty-${i}`}>
                      <div className="h-full" />
                    </EditorialShelf>
                  ))}
                    </>
                  )}
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
                        책이 6권 이상 쌓이면 예시 책들이 사라져요. 지금 첫 책을 등록해보세요!
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* 결과 없음 — 필터/검색으로 0건일 때 */}
                {showNoResults && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 mx-auto max-w-[520px] text-center px-5 py-8"
                  >
                    <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
                      <Search className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">조건에 맞는 책이 없어요</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {searchQuery.trim()
                        ? <>‘{searchQuery.trim()}’ 검색 결과가 없어요. 다른 검색어나 필터를 바꿔보세요.</>
                        : '필터를 바꾸거나 초기화해보세요.'}
                    </p>
                    {(statusFilter !== 'all' || selectedDistricts.length > 0) && (
                      <button
                        onClick={() => { setStatusFilter('all'); setSelectedDistricts([]); }}
                        className="mt-3 text-xs font-semibold text-primary underline underline-offset-2"
                      >
                        필터 초기화
                      </button>
                    )}
                  </motion.div>
                )}
              </motion.div>
        )}
      </div>

      {/* Heart FAB */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        onClick={() => { if (requireAuth()) setShowLikedBooks(true); }}
      >
        <Heart className="w-6 h-6" />
        {likedBooks.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
            {likedBooks.length}
          </span>
        )}
      </motion.button>

      {/* Filter Dialog */}
      <Dialog open={showFilterSheet} onOpenChange={v => { setShowFilterSheet(v); if (!v) setDistrictDropdownOpen(false); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl mb-[4vh] overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-left text-base">필터 / 정렬</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
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

            {/* 책 상태는 헤더 칩으로 상시 노출한다 — 시트에 두면 같은 필터가 두 곳에 생긴다 */}

            {/* District multi-select — inline expand (no absolute, no overflow-clip issue) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">관심 지역</p>
                {selectedDistricts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDistricts([])}
                    className="text-[13px] text-muted-foreground underline underline-offset-2"
                  >
                    선택 해제 ({selectedDistricts.length})
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                현재 싱가포르 지역만 서비스해요. 지역은 책 등록·거래 위치 기준이에요.
              </p>

              {/* Trigger button */}
              <button
                type="button"
                onClick={() => setDistrictDropdownOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-1.5 text-left min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {selectedDistricts.length === 0
                    ? <span className="text-muted-foreground">지역 선택 (복수 가능)</span>
                    : <span className="text-foreground font-medium truncate">{selectedDistricts.join(', ')}</span>
                  }
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${districtDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Inline expanded list — in document flow so dialog can scroll */}
              {districtDropdownOpen && (
                <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                  <div className="grid grid-cols-2 gap-px bg-border">
                    {availableDistricts.map(d => {
                      const checked = selectedDistricts.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSelectedDistricts(prev =>
                            checked ? prev.filter(x => x !== d) : [...prev, d]
                          )}
                          className={`flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                            checked ? 'bg-primary/10 text-primary font-medium' : 'bg-background hover:bg-muted/60 text-foreground/80'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            checked ? 'bg-primary border-primary' : 'border-border'
                          }`}>
                            {checked && (
                              <svg className="w-2 h-2 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                              </svg>
                            )}
                          </span>
                          <span className="truncate text-xs">{d}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Reset */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setStatusFilter('all'); setSortBy('newest'); setSelectedDistricts([]); }}
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
        myBookCount={user ? allBooks.filter((b) => b.owner_id === user.id).length : undefined}
        myBorrowCount={user ? getMyBorrowCount() : undefined}
        onEdit={(book) => setEditingBook(book)}
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
