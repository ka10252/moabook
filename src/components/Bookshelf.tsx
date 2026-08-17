import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from 'react';
import { track } from '@/lib/analytics';
import { motion, AnimatePresence } from 'framer-motion';
import { EditorialShelf } from './EditorialShelf';
import { useFavoriteAreas } from '@/hooks/useFavoriteAreas';
import { CoverShelf } from './CoverShelf';
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
// ⚠️ lucide의 Map은 반드시 별칭으로 가져온다. 그냥 `Map`으로 import 하면
//    이 모듈 안에서 전역 Map 생성자를 가려 `new Map<...>()`이 "Map is not a constructor"로 터진다.
import { ChevronDown, Loader2, BookOpen, Heart, History, Search, X, MapPin, SlidersHorizontal, LayoutGrid, Library, Map as MapIcon, ArrowLeft, Star } from 'lucide-react';
import { BookMapView } from '@/components/BookMapView';
import { STATION_DISTRICTS, MRT_STATIONS, getStation } from '@/data/mrtStations';
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

type ShelfBook = Book & {
  _isBorrowed?: boolean;
  _isDummy?: boolean;
  /** 이 책 앞에 칸막이를 그린다. 값은 칸막이에 세로로 적히는 이름 */
  _divider?: string;
};
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
  // 커뮤니티에서 넘어왔는지 — 딥링크로 받은 커뮤니티를 계속 보고 있을 때만 뒤로가기를 띄운다.
  // 유저가 드롭다운으로 직접 커뮤니티를 고른 경우엔 돌아갈 곳이 없다.
  const cameFromCommunity = !!initialCommunityId && activeFilter === initialCommunityId;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);
  // 역 단위 필터. 지역(planning area)은 몇 km라 "이 역 근처"를 못 고른다.
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [stationDropdownOpen, setStationDropdownOpen] = useState(false);
  const { favStations, favDistricts, toggleStation: toggleFavStation, toggleDistrict: toggleFavDistrict } = useFavoriteAreas();
  // 즐겨찾기는 '한 번에 적용'이 아니라 목록 순서만 바꾼다 — 별을 누른 역·지역이
  // 목록 맨 위로 올라와 바로 고를 수 있다. 지역 선택은 이 필터 시트 안에서만 한다.

  const [stationQuery, setStationQuery] = useState('');
  const [districtQuery, setDistrictQuery] = useState('');
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
  // 보기 모드 — 책등(spine) · 표지(cover) · 지도(map)
  type ShelfView = 'spine' | 'cover' | 'map';
  const [viewMode, setViewMode] = useState<ShelfView>(() => {
    try {
      const v = localStorage.getItem('moa_shelf_view');
      return v === 'cover' || v === 'map' ? v : 'spine';
    } catch { return 'spine'; }
  });
  const changeView = (next: ShelfView) => {
    setViewMode(next);
    try { localStorage.setItem('moa_shelf_view', next); } catch { /* ignore */ }
  };

  // 지도에서 "내 위치" 기준으로 쓸 내 역. 없으면 반경 표시만 빠진다.
  const [myStation, setMyStation] = useState<string | null>(null);
  useEffect(() => {
    if (!user) { setMyStation(null); return; }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('mrt_station')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setMyStation((data as { mrt_station?: string | null } | null)?.mrt_station ?? null);
      });
    return () => { cancelled = true; };
  }, [user]);

  const calcBooksPerShelf = useCallback((contentWidth: number) => {
    // contentWidth = content-box width of the outer scroll container (inside px-6 padding)
    // On wide screens clamp to 520px so the shelf doesn't stretch beyond a readable width
    // 칸 뒷판 px-3(24px) 좌우 패딩 → 예산에서 뺀다.
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

  // 당겨서 새로고침은 이제 앱 전역(window 스크롤 기준) <PullToRefresh/>가 담당한다.
  // (예전의 컨테이너 scrollTop 기반 PtR은 문서 레벨 스크롤 구조에서 오작동했다.)
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

  /**
   * 역·지역 선택지는 싱가포르 전체를 다 보여준다. 책이 있는 곳만 남기면
   * "저 동네는 아예 서비스가 안 되나?"로 읽히고, 앞으로 생길 동네를 미리 볼 수도 없다.
   * 대신 각 항목에 현재 권수를 같이 적어 빈 곳인지 바로 알 수 있게 한다.
   */
  const bookCountByStation = useMemo(() => {
    const counts = new Map<string, number>();
    allBooks.forEach((b) => {
      const id = b.owner?.mrtStation;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    return counts;
  }, [allBooks]);

  const bookCountByDistrict = useMemo(() => {
    const counts = new Map<string, number>();
    allBooks.forEach((b) => {
      const d = b.owner?.district;
      if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
    });
    return counts;
  }, [allBooks]);

  // 별표한 역이 맨 위, 그다음 책이 있는 역. 전부 보여주되 쓸모 있는 것부터 보인다.
  const stationOptions = useMemo(() => {
    return MRT_STATIONS
      .map((station) => ({ station, count: bookCountByStation.get(station.id) ?? 0 }))
      .sort((a, b) => {
        const fav = Number(favStations.includes(b.station.id)) - Number(favStations.includes(a.station.id));
        if (fav !== 0) return fav;
        return b.count - a.count || a.station.name.localeCompare(b.station.name);
      });
  }, [bookCountByStation, favStations]);

  useEffect(() => {
    setAvailableDistricts(STATION_DISTRICTS);
  }, []);

  const districtOptions = useMemo(
    () => [...availableDistricts].sort((a, b) => {
      const fav = Number(favDistricts.includes(b)) - Number(favDistricts.includes(a));
      if (fav !== 0) return fav;
      return a.localeCompare(b);
    }),
    [availableDistricts, favDistricts],
  );

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

    // 역과 지역은 OR가 아니라 AND로 좁힌다 — 둘 다 고르면 "그 지역의 그 역"이 된다.
    if (selectedStations.length > 0) {
      books = books.filter(book => {
        const s = book.owner?.mrtStation;
        return !!s && selectedStations.includes(s);
      });
    }

    if (selectedDistricts.length > 0) {
      books = books.filter(book => {
        const d = book.owner?.district;
        return !!d && selectedDistricts.includes(d);
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      books = books.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    }

    return sortShelfBooks(applyStatusFilter(books));
  }, [allBooks, activeFilter, user?.id, communityMemberIds, selectedStations, selectedDistricts, searchQuery, sortShelfBooks, applyStatusFilter]);

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

      // 예전엔 세 종류를 각각 별도 섹션으로 넣었다. 그러면 빌린 책 한 권 때문에
      // 서가 한 칸이 통째로 새로 생겨 휑해 보였다. 이제는 한 줄기로 잇고
      // 종류가 바뀌는 지점에만 칸막이를 세운다.
      const nonEmpty = [own, lent, borrowed].filter(a => a.length > 0).length;
      const labelize = nonEmpty > 1 || hasCommunity;

      const personal: ShelfBook[] = [...own];
      const appendWithDivider = (arr: ShelfBook[], name: string) => {
        arr.forEach((b, i) => {
          personal.push(i === 0 && personal.length > 0 ? { ...b, _divider: name } : b);
        });
      };
      appendWithDivider(lent, '빌려준 책');
      appendWithDivider(borrowed, '빌린 책');

      if (personal.length) addSection(personal, labelize ? '내 서가' : undefined);
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
  // 배너 자체는 없앴지만(설명문이 첫 화면에 먼저 보이는 게 거슬렸다) 이 조건은
  // '결과 없음' 판정에 그대로 쓴다 — 예시 책이 깔린 화면은 빈 화면이 아니다.
  const showDummyBanner = canShowDummy(activeFilter, statusFilter, searchQuery, totalRealBooks);

  // 필터·검색을 걸었는데 0건이면 빈 서가만 보여선 안 된다 — 왜 비었는지 알려준다.
  const hasActiveQuery =
    searchQuery.trim() !== '' || statusFilter !== 'all' || selectedDistricts.length > 0 || selectedStations.length > 0;
  const showNoResults = totalRealBooks === 0 && hasActiveQuery && !showDummyBanner;

  // 결과 없음 안내를 띄울 땐 장식용 빈 서가 필러를 숨겨 메시지가 붕 뜨지 않게 한다.
  /**
   * 표지 보기용 섹션.
   *
   * shelfGroups는 booksPerShelf(책등 한 칸에 몇 권 들어가나) 단위로 잘려 있다.
   * 그 값을 표지 보기에도 쓰면, 그룹마다 grid-cols-3을 새로 그리게 되어
   * 그룹 끝에서 줄이 남고 다음 그룹은 새 줄에서 시작한다(3+1, 그리고 1 ...).
   * 청킹은 책등 보기에서만 의미가 있으므로, 여기서는 라벨을 기준으로 도로 합친다.
   */
  const coverSections = useMemo(() => {
    const out: ShelfGroup[] = [];
    shelfGroups.forEach((g, i) => {
      const startsNewSection = i === 0 || !!g.label;
      if (startsNewSection) out.push({ label: g.label, books: [...g.books] });
      else out[out.length - 1].books.push(...g.books);
    });
    return out;
  }, [shelfGroups]);

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
    (selectedDistricts.length > 0 ? 1 : 0) +
    (selectedStations.length > 0 ? 1 : 0);

  return (
    <div className="flex flex-col min-h-full relative">
      {/* Header — 페이지 스크롤 시 상단(앱 헤더 아래)에 고정 */}
      <header className="flex flex-col gap-3 px-5 pt-4 pb-3 bg-background/85 backdrop-blur-md sticky top-14 z-30 border-b border-border/40">
        {/* Title block — 제목 자체가 '책장 범위' 선택기다.
            예전엔 제목과 드롭다운이 같은 값을 두 번 보여줬다(중복). 제목을 컨트롤로 만들면
            드롭다운이 컨트롤 줄에서 빠지고, 그 자리를 상태 칩이 쓴다 → 줄 수는 그대로. */}
        <div className="flex items-end justify-between gap-2">
          {/* 커뮤니티에서 책장을 눌러 들어온 경우 돌아갈 길을 만든다.
              여기는 모달이 아니라 다른 화면으로 '이동'한 것이라, 안 만들면
              하단 탭을 눌러 커뮤니티를 다시 찾아 들어가야 한다. */}
          {cameFromCommunity && (
            <button
              type="button"
              onClick={() => window.history.back()}
              aria-label="커뮤니티로 돌아가기"
              className="mb-1 -ml-1 mr-0.5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
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

          {/* 책등 · 표지 · 지도 — 세 모드가 다 보이는 세그먼트 토글(현재 모드가 채워져 보임) */}
          <div
            role="group"
            aria-label="보기 방식"
            className="flex items-center shrink-0 rounded-full border border-border p-0.5"
          >
            {([
              { key: 'spine', Icon: Library, label: '책등으로 보기' },
              { key: 'cover', Icon: LayoutGrid, label: '표지로 보기' },
              { key: 'map', Icon: MapIcon, label: '지도로 보기' },
            ] as const).map(({ key, Icon, label }) => (
              <button
                key={key}
                onClick={() => { if (viewMode !== key) changeView(key); }}
                aria-pressed={viewMode === key}
                aria-label={label}
                title={label}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  viewMode === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

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
        }}
        className="flex-1 px-6 py-4"
      >
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
        ) : viewMode === 'map' ? (
          <div className="max-w-[520px] mx-auto w-full -mx-2">
            <BookMapView
              books={filteredBooks}
              myStationId={myStation}
              onSelectBook={(book) => {
                trackBrowse();
                track('book_viewed', { book_id: book.id, from: 'map' });
                setSelectedBook(book);
              }}
            />
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
                <div
                  data-onboarding="shelf"
                  // 표지 보기도 책등과 같은 서가 프레임을 쓴다(F18).
                  // 표지만 허공에 떠 있으면 '책장'으로 안 읽힌다.
                  className="relative shelf-vignette overflow-hidden rounded-lg"
                >
                  {viewMode === 'cover' ? (
                    coverSections.map((group, gi) => {
                      // 3권씩 끊어 한 줄로. 줄 하나가 선반 한 칸이 된다.
                      const shown = group.books.filter((b) => !b._isDummy);
                      const rows: typeof shown[] = [];
                      for (let i = 0; i < shown.length; i += 3) rows.push(shown.slice(i, i + 3));
                      return rows.map((row, ri) => (
                        <CoverShelf key={`${gi}-${ri}`} label={ri === 0 ? group.label || undefined : undefined}>
                          {row.map((book) => (
                            <BookCover
                              key={book.id}
                              book={book}
                              onClick={() => { trackBrowse(); track('book_viewed', { book_id: book.id, from: 'shelf' }); setSelectedBook(book); }}
                              isRented={book.status === 'rented'}
                              isLent={!book._isBorrowed && lentBookIds.has(book.id)}
                              isBorrowed={!!book._isBorrowed}
                            />
                          ))}
                        </CoverShelf>
                      ));
                    })
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
                        const spine = (
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
                        // 종류가 바뀌는 자리에만 칸막이. 같은 칸 안에서 경계를 알린다.
                        if (!book._divider) return spine;
                        return (
                          <Fragment key={`div-${book.id}`}>
                            <div
                              aria-hidden="true"
                              className="self-stretch flex items-end justify-center shrink-0 px-1.5"
                            >
                              <div className="relative h-full flex items-center">
                                <span className="block w-px h-[78%] bg-border" />
                                <span
                                  className="absolute left-1/2 -translate-x-1/2 bottom-1 text-[9px] tracking-tight text-muted-foreground bg-background px-0.5"
                                  style={{ writingMode: 'vertical-rl' }}
                                >
                                  {book._divider}
                                </span>
                              </div>
                            </div>
                            {spine}
                          </Fragment>
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

                {/* 예시 화면 안내 배너는 없앴다 — 책 카드마다 '예시' 배지가 붙어 있어
                    오해할 일이 없고, 첫 화면에 설명문이 먼저 보이는 게 더 거슬렸다. */}

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
                    {(statusFilter !== 'all' || selectedDistricts.length > 0 || selectedStations.length > 0) && (
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
      <Dialog open={showFilterSheet} onOpenChange={v => { setShowFilterSheet(v); if (!v) { setDistrictDropdownOpen(false); setStationDropdownOpen(false); setStationQuery(""); setDistrictQuery(""); } }}>
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

            {/* 역으로 찾기 — 지역보다 좁게. 목록엔 실제로 책이 있는 역만 나온다. */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">가까운 MRT</p>
                {selectedStations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedStations([])}
                    className="text-[13px] text-muted-foreground underline underline-offset-2"
                  >
                    선택 해제 ({selectedStations.length})
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setStationDropdownOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-1.5 text-left min-w-0">
                  <MapIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {selectedStations.length === 0
                    ? <span className="text-muted-foreground">역 선택 (복수 가능)</span>
                    : <span className="text-foreground font-medium truncate">
                        {selectedStations.map(id => getStation(id)?.name ?? id).join(', ')}
                      </span>
                  }
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${stationDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {stationDropdownOpen && (
                <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                  {(
                    <div className="p-2 border-b border-border bg-background sticky top-0 z-10">
                      <input
                        type="text"
                        value={stationQuery}
                        onChange={(e) => setStationQuery(e.target.value)}
                        placeholder="역 이름 검색 (Clementi, 클레멘티, 노선 EW)"
                        className="w-full h-9 px-3 rounded-lg bg-muted/50 border-0 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none"
                      />
                    </div>
                  )}
                  <div className="max-h-56 overflow-y-auto">
                    {stationOptions
                      .filter(({ station }) => {
                        const q = stationQuery.trim().toLowerCase();
                        if (!q) return true;
                        return station.name.toLowerCase().includes(q)
                          || station.nameKo.includes(stationQuery.trim())
                          || station.district.toLowerCase().includes(q)
                          || station.region.includes(stationQuery.trim())
                          || station.lines.some((l) => l.toLowerCase() === q);
                      })
                      .map(({ station, count }) => {
                        const checked = selectedStations.includes(station.id);
                        const faved = favStations.includes(station.id);
                        return (
                          // 행 안에 별 버튼을 넣어야 해서 div다 — button 안에 button은 못 넣는다
                          <div
                            key={station.id}
                            className={`w-full flex items-center gap-2 px-3 text-sm transition-colors ${
                              checked ? 'bg-primary/10 text-primary font-medium' : 'bg-background hover:bg-muted/60 text-foreground/80'
                            }`}
                          >
                          <button
                            type="button"
                            onClick={() => setSelectedStations(prev =>
                              checked ? prev.filter(x => x !== station.id) : [...prev, station.id]
                            )}
                            className="flex-1 min-w-0 flex items-center gap-2 py-2.5 text-left"
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
                            <span className="truncate text-xs">
                              {station.name} <span className="text-muted-foreground">{station.nameKo}</span>
                            </span>
                            <span className={`ml-auto text-[11px] shrink-0 ${count > 0 ? 'text-muted-foreground' : 'text-faint'}`}>
                              {count > 0 ? `${count}권` : '없음'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFavStation(station.id)}
                            aria-label={faved ? `${station.name} 즐겨찾기 해제` : `${station.name} 즐겨찾기`}
                            aria-pressed={faved}
                            className="shrink-0 p-1.5 -mr-1"
                          >
                            <Star className={`w-3.5 h-3.5 ${faved ? 'fill-primary text-primary' : 'text-border'}`} />
                          </button>
                          </div>
                        );
                      })}
                    {stationOptions.filter(({ station }) => {
                      const q = stationQuery.trim().toLowerCase();
                      if (!q) return true;
                      return station.name.toLowerCase().includes(q)
                        || station.nameKo.includes(stationQuery.trim())
                        || station.district.toLowerCase().includes(q)
                        || station.region.includes(stationQuery.trim())
                        || station.lines.some((l) => l.toLowerCase() === q);
                    }).length === 0 && (
                      <p className="px-3 py-4 text-[11px] text-muted-foreground text-center">
                        그런 역이 없어요. 영문·한글 어느 쪽으로 쳐도 찾을 수 있어요.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

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
                  <div className="p-2 border-b border-border bg-background">
                    <input
                      type="text"
                      value={districtQuery}
                      onChange={(e) => setDistrictQuery(e.target.value)}
                      placeholder="지역 검색 (Clementi, Tampines)"
                      className="w-full h-9 px-3 rounded-lg bg-muted/50 border-0 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-border max-h-56 overflow-y-auto">
                    {districtOptions
                      .filter(d => !districtQuery.trim() || d.toLowerCase().includes(districtQuery.trim().toLowerCase()))
                      .map(d => {
                      const checked = selectedDistricts.includes(d);
                      const dCount = bookCountByDistrict.get(d) ?? 0;
                      const dFaved = favDistricts.includes(d);
                      return (
                        <div
                          key={d}
                          className={`flex items-center gap-2 px-3 text-sm transition-colors ${
                            checked ? 'bg-primary/10 text-primary font-medium' : 'bg-background hover:bg-muted/60 text-foreground/80'
                          }`}
                        >
                        <button
                          type="button"
                          onClick={() => setSelectedDistricts(prev =>
                            checked ? prev.filter(x => x !== d) : [...prev, d]
                          )}
                          className="flex-1 min-w-0 flex items-center gap-2 py-2.5 text-left"
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
                          <span className={`ml-auto text-[10.5px] shrink-0 ${dCount > 0 ? 'text-muted-foreground' : 'text-faint'}`}>
                            {dCount > 0 ? dCount : ''}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFavDistrict(d)}
                          aria-label={dFaved ? `${d} 즐겨찾기 해제` : `${d} 즐겨찾기`}
                          aria-pressed={dFaved}
                          className="shrink-0 p-1.5 -mr-1"
                        >
                          <Star className={`w-3.5 h-3.5 ${dFaved ? 'fill-primary text-primary' : 'text-border'}`} />
                        </button>
                        </div>
                      );
                    })}
                  </div>
                  {districtOptions.filter(d => !districtQuery.trim() || d.toLowerCase().includes(districtQuery.trim().toLowerCase())).length === 0 && (
                    <p className="px-3 py-4 text-[11px] text-muted-foreground text-center bg-background">
                      그런 지역이 없어요.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Reset */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setStatusFilter('all'); setSortBy('newest'); setSelectedDistricts([]); setSelectedStations([]); }}
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
