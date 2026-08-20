import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from 'react';
import { track } from '@/lib/analytics';
import { motion, AnimatePresence } from 'framer-motion';
import { EditorialShelf } from './EditorialShelf';
import { useFavoriteAreas } from '@/hooks/useFavoriteAreas';
import { useBookCommunityVisibility } from '@/hooks/useBookCommunityVisibility';
import { CoverShelf } from './CoverShelf';
import { GENRES, UNKNOWN_GENRE, isGenre, type Genre } from '@/lib/genre';
import { BookSpine, spineWidthFor } from './BookSpine';
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
import { ChevronDown, Loader2, BookOpen, Heart, History, Search, X, MapPin, SlidersHorizontal, LayoutGrid, Library, Map as MapIcon, ArrowLeft, Star, Tag } from 'lucide-react';
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

/**
 * 예시 책은 아무 조건도 안 건 기본 화면(모두의 책장 · 전체 · 검색어 없음)에서만 채운다.
 *
 * ⚠️ 필터를 새로 만들면 **여기에도 추가해야 한다.** 안 그러면 필터를 걸어 결과가 줄었을 때
 *    빈자리를 예시 책이 메워, 조건에 맞지도 않는 책이 섞여 나온다.
 *    (장르 필터를 넣었을 때 실제로 '채식주의자'가 경제·경영 결과에 끼어들었다)
 */
const canShowDummy = (
  activeFilter: string,
  statusFilter: StatusFilter,
  searchQuery: string,
  extraFilterOn: boolean,
  realCount: number
) =>
  activeFilter === 'everybody' &&
  statusFilter === 'all' &&
  !searchQuery.trim() &&
  !extraFilterOn &&
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
  /** 헤더의 장르 드롭다운(필터 시트 안의 것과 별개) */
  const [genreBarOpen, setGenreBarOpen] = useState(false);
  /** 검색창은 평소 접어둔다 — 헤더 두께를 줄이려고 */
  const [searchOpen, setSearchOpen] = useState(false);
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
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([]);

  // Dynamic booksPerShelf based on container width
  const bookcaseRef = useRef<HTMLDivElement>(null);
  /** 한 칸(선반)의 안쪽 폭(px). 책등 두께가 제각각이라 권수가 아니라 폭으로 나눈다. */
  const [shelfWidthPx, setShelfWidthPx] = useState(320);
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
    // 지도는 화면에 꼭 맞게 그려진다. 스크롤이 내려간 상태로 바꾸면 높이 계산의
    // 기준(컨테이너의 화면상 위치)이 어긋나므로 맨 위로 올린다.
    if (next === 'map') window.scrollTo({ top: 0 });
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
    // ⚠️ 이 값은 이제 '한 칸에 몇 권'이 아니라 **한 칸의 폭(px)** 이다.
    //    책등 두께가 제목 길이에 따라 달라져서(28~37px) 권수로 세면 칸이 남거나 넘친다.
    setShelfWidthPx(Math.min(contentWidth, 520) - 24);
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
  // 커뮤니티 책장 판정에 쓴다. 커뮤니티를 보고 있을 때만 조회하면 되지만,
  // 책 목록이 바뀔 때마다 다시 읽는 비용이 작아 그냥 전체를 들고 있는다.
  const { isVisibleIn } = useBookCommunityVisibility(
    activeFilter === 'everybody' || activeFilter === 'mine' ? [] : allBooks.map((b) => b.id),
  );

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

  /**
   * 역·지역·검색 — 어느 서가에 놓일 책이든 똑같이 통과해야 하는 조건.
   *
   * 함수로 뽑아둔 이유: 예전엔 '모두의 책장' 목록에만 필터를 걸고
   * '내 서가' 목록은 따로 만들어서, **내 책에는 장르 필터가 아예 안 걸렸다.**
   * 목록마다 조건을 다시 쓰면 또 어긋난다.
   */
  const passesFilters = useCallback((book: Book) => {
    // 역과 지역은 OR가 아니라 AND로 좁힌다 — 둘 다 고르면 "그 지역의 그 역"이 된다.
    if (selectedStations.length > 0) {
      const st = book.owner?.mrtStation;
      if (!st || !selectedStations.includes(st)) return false;
    }
    if (selectedDistricts.length > 0) {
      const d = book.owner?.district;
      if (!d || !selectedDistricts.includes(d)) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (!book.title.toLowerCase().includes(q) && !book.author.toLowerCase().includes(q)) return false;
    }
    return true;
  }, [selectedStations, selectedDistricts, searchQuery]);

  /** 장르는 따로 — 칩 옆의 권수를 '장르만 빼고 나머지를 적용한' 목록에서 세야 한다 */
  const passesGenre = useCallback((book: Book) => {
    if (selectedGenres.length === 0) return true;
    // genre가 비었거나 우리가 모르는 값이면 '기타'로 본다 — 옛 책도 어딘가엔 속해야
    // 필터를 켰을 때 조용히 사라지지 않는다.
    return selectedGenres.includes(isGenre(book.genre) ? book.genre : UNKNOWN_GENRE);
  }, [selectedGenres]);

  /**
   * 장르를 **뺀** 나머지 필터까지만 적용한 목록.
   * 장르 칩 옆의 권수를 여기서 센다 — 이유는 genreCounts 주석 참고.
   */
  const booksBeforeGenre = useMemo(() => {
    let books = allBooks;

    if (activeFilter === 'mine') {
      books = books.filter(book => book.owner_id === user?.id);
    } else if (activeFilter !== 'everybody') {
      /**
       * 커뮤니티 책장에 보이는 책 (마이그 `20260820000001`)
       *   커뮤니티 전용 책 : `book_community_visibility` 에 이 커뮤니티가 **공개**로 들어 있을 때
       *   전체공개 책      : 멤버의 책이면 기본 노출, 단 이 커뮤니티가 **숨김**으로 들어 있으면 제외
       *
       * 예전엔 `books.community_id` 하나만 봐서 (a) 여러 커뮤니티에 올릴 수 없고
       * (b) 전체공개를 고르면 내가 속한 모든 커뮤니티에 강제로 올라갔다.
       */
      books = books.filter(book => {
        if (!book.is_public) return isVisibleIn(book.id, activeFilter, false);
        if (!communityMemberIds.has(book.owner_id)) return false;
        return isVisibleIn(book.id, activeFilter, true);
      });
    }

    return applyStatusFilter(books.filter(passesFilters));
  }, [allBooks, activeFilter, user?.id, communityMemberIds, passesFilters, applyStatusFilter, isVisibleIn]);

  const filteredBooks = useMemo(
    () => sortShelfBooks(booksBeforeGenre.filter(passesGenre)),
    [booksBeforeGenre, passesGenre, sortShelfBooks],
  );

  /**
   * 장르별 권수.
   *
   * 세는 대상은 **장르만 빼고 나머지 필터를 다 적용한 목록**이다.
   * 전체 서가를 세면 "소설 12"를 눌렀는데 3권만 나오고, 지금 보이는 목록만 세면
   * 이미 고른 장르 말고는 전부 0이 되어 다른 장르로 옮겨갈 수가 없다.
   */
  const genreCounts = useMemo(() => {
    const counts = new Map<Genre, number>();
    for (const b of booksBeforeGenre) {
      const g = isGenre(b.genre) ? b.genre : UNKNOWN_GENRE;
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return counts;
  }, [booksBeforeGenre]);

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

  /**
   * 내가 빌린 남의 책. `allBooks` 에 있지만 '내 서가' 탭은 주인으로 걸러내므로
   * 여기서 따로 챙긴다. 필터는 다른 책과 똑같이 통과시킨다.
   */
  const myBorrowedBooks = useMemo((): ShelfBook[] => {
    if (!user) return [];
    const rentedInfo = getRentedBooksInfo();
    return applyStatusFilter(
      allBooks.filter(b => rentedInfo.has(b.id) && b.owner_id !== user.id && passesFilters(b) && passesGenre(b)),
    ).map(b => ({ ...b, _isBorrowed: true } as ShelfBook));
  }, [allBooks, getRentedBooksInfo, user?.id, passesFilters, passesGenre, applyStatusFilter]);

  /**
   * 서가에 그릴 책 전체.
   *
   * 예전엔 '내 서가'(내가 올린 책 전부)를 맨 앞 칸에 통째로 박아뒀다. 그런데
   * 내가 올린 책은 내가 이미 아는 책이라, 첫 줄을 그것으로 채우면 **남의 책을
   * 둘러보는 데 방해만 됐다.** 지금은 거래 중인 책(빌려준·빌린)만 위로 올리고
   * 나머지는 내 책·남의 책 구분 없이 섞는다. 내가 올린 책은 '내 서가' 탭에서 본다.
   */
  const shelfSource = useMemo((): ShelfBook[] => {
    // '내 서가' 탭에서는 내가 빌린 책도 함께 보여준다 (그 탭의 목적이 "내 손에 있는 책")
    if (activeFilter === 'mine') {
      return sortShelfBooks([...(filteredBooks as ShelfBook[]), ...myBorrowedBooks]);
    }
    return filteredBooks as ShelfBook[];
  }, [filteredBooks, myBorrowedBooks, activeFilter, sortShelfBooks]);

  /** 거래 중인 책 = 위로 올라가는 것들. 나머지는 아래에 섞인다. */
  const { dealBooks, mixedBooks } = useMemo(() => {
    const rentedInfo = getRentedBooksInfo();
    const lent: ShelfBook[] = [];
    const borrowed: ShelfBook[] = [];
    const rest: ShelfBook[] = [];

    for (const b of shelfSource) {
      if (b.owner_id === user?.id && lentBookIds.has(b.id)) lent.push(b);
      else if (b.owner_id !== user?.id && rentedInfo.has(b.id)) borrowed.push({ ...b, _isBorrowed: true });
      else rest.push(b);
    }

    // '빌려준 책'·'빌린 책'은 **책갈피(구분선)**로만 알린다.
    // 예전엔 첫 묶음을 서가 제목으로 올렸는데, 그러면 '모두의 책장' 제목과 똑같은 모양이라
    // 같은 층위처럼 보였다. 이건 서가를 나누는 게 아니라 책 사이에 끼우는 표시다.
    const deal: ShelfBook[] = [];
    const append = (arr: ShelfBook[], name: string) =>
      arr.forEach((b, i) => deal.push(i === 0 ? { ...b, _divider: name } : b));
    append(lent, '빌려준 책');
    append(borrowed, '빌린 책');

    return { dealBooks: deal, mixedBooks: rest };
  }, [shelfSource, lentBookIds, getRentedBooksInfo, user?.id]);

  /**
   * 같은 책(제목+저자)이 여러 권 올라와 있으면 하나만 보여주고 권수를 배지로 알린다.
   * 표지가 똑같은 칸이 나란히 서면 "책이 많다"가 아니라 "화면이 고장났다"로 읽힌다.
   */
  const { dedupedMixedBooks, mixedDuplicateCounts } = useMemo(() => {
    const seenKey = new Map<string, ShelfBook>();
    const counts = new Map<string, number>();
    for (const book of mixedBooks) {
      const key = `${book.title.toLowerCase().trim()}|||${book.author.toLowerCase().trim()}`;
      if (!seenKey.has(key)) {
        seenKey.set(key, book);
        counts.set(book.id, 1);
      } else {
        const rep = seenKey.get(key)!;
        counts.set(rep.id, (counts.get(rep.id) ?? 1) + 1);
      }
    }
    return { dedupedMixedBooks: [...seenKey.values()], mixedDuplicateCounts: counts };
  }, [mixedBooks]);

  /** 결과를 좁히는 필터가 하나라도 켜져 있나 (예시 책을 끼워 넣으면 안 되는 상태) */
  const narrowingFilterOn =
    selectedGenres.length > 0 || selectedStations.length > 0 || selectedDistricts.length > 0;

  // Dynamic shelf groups — books fill shelves continuously within each section
  const shelfGroups = useMemo((): ShelfGroup[] => {
    const groups: ShelfGroup[] = [];

    /**
     * 책을 칸에 채운다. **권수가 아니라 폭으로 나눈다** —
     * 책등 두께가 제목 길이에 따라 28~37px 로 달라져서, 권수로 자르면 어떤 칸은 남고
     * 어떤 칸은 넘친다(실제로 칸 절반이 비어 보였다).
     */
    const GAP = 6;
    const addSection = (books: ShelfBook[], firstLabel?: string) => {
      let used = 0;
      books.forEach((book, i) => {
        const w = spineWidthFor(book.title || '');
        const isFirst = i === 0;
        if (isFirst || used + w + GAP > shelfWidthPx) {
          groups.push({ label: isFirst ? firstLabel : undefined, books: [] });
          used = 0;
        }
        groups[groups.length - 1].books.push(book);
        used += w + GAP;
      });
    };

    // 거래 중인 책이 맨 위. 그 아래로는 내 책·남의 책 섞어서 채운다.
    //
    // 서가 칸에 제목을 달지 않는다. '내 서가 / 모두의 책장'으로 나눠 놓던 시절엔
    // 어디까지가 누구 책인지 알려줄 필요가 있었지만, 지금은 섞여 있으니 알려줄 게 없다.
    // 거래 중인 책만 책갈피(_divider)로 표시된다.
    if (dealBooks.length) addSection(dealBooks);
    if (dedupedMixedBooks.length) addSection(dedupedMixedBooks);

    // 예시 책은 "아직 책이 없는 새 책장"을 덜 휑하게 보이려고 두는 것이다.
    // 필터·검색으로 결과가 줄어든 건 빈 책장이 아니라 "조건에 맞는 책이 그것뿐"인 상태다.
    // 거기에 예시 책을 채우면 필터가 고장난 것처럼 보인다 — 그래서 기본 화면에서만 채운다.
    const totalRealBooks = dealBooks.length + dedupedMixedBooks.length;
    if (canShowDummy(activeFilter, statusFilter, searchQuery, narrowingFilterOn, totalRealBooks)) {
      addSection(DUMMY_BOOKS.slice(0, DUMMY_THRESHOLD - totalRealBooks));
    }

    return groups;
  }, [dealBooks, dedupedMixedBooks, activeFilter, statusFilter, shelfWidthPx, searchQuery, narrowingFilterOn]);

  const totalRealBooks = dealBooks.length + dedupedMixedBooks.length;
  // 배너 자체는 없앴지만(설명문이 첫 화면에 먼저 보이는 게 거슬렸다) 이 조건은
  // '결과 없음' 판정에 그대로 쓴다 — 예시 책이 깔린 화면은 빈 화면이 아니다.
  const showDummyBanner = canShowDummy(activeFilter, statusFilter, searchQuery, narrowingFilterOn, totalRealBooks);

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

  /**
   * 서가는 책이 없어도 **화면을 채운다.**
   *
   * 예전엔 결과가 없으면 빈 선반을 1칸만 그리고 그 아래 안내문을 뒀다. 그러면
   * 서가가 화면 위쪽에 조각처럼 떠 있고 아래가 텅 비어서, "책장"이 아니라
   * "오류 화면"으로 읽혔다. 조건을 바꾸면 다시 책이 들어올 자리라는 게 보여야 한다.
   *
   * 몇 칸이 필요한지는 폰마다 다르므로 **남은 높이를 재서** 계산한다.
   * 3칸 같은 고정값을 쓰면 큰 폰에서는 남고 작은 폰에서는 넘친다.
   */
  const SHELF_ROW_H = 207; // EditorialShelf 한 칸: 뒷판 여백 10 + 책 자리 184 + 선반 판 13
  const SHELF_CHROME = 23; // 한 칸에서 책 자리를 뺀 나머지(뒷판 여백 + 선반 판)
  const [shelfFillRows, setShelfFillRows] = useState(3);
  /** 빈 칸 하나의 책 자리 높이 — 남는 높이를 칸 수로 나눠 아래에 빈 배경이 안 남게 한다 */
  const [shelfFillRowH, setShelfFillRowH] = useState(184);
  const shelfFrameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (viewMode === 'map') return;
    const measure = () => {
      const frameEl = shelfFrameRef.current;
      const container = bookcaseRef.current;
      if (!frameEl || !container) return;

      /**
       * 쓸 수 있는 높이 = (탭바 위 경계) − (프레임의 위) − (프레임 아래 남는 것)
       *
       * ⚠️ 세 값 모두 **프레임 높이와 무관해야 한다.** 아니면 되먹임이 생긴다.
       *    실제로 두 번 틀렸다:
       *     · `main`의 아래 빈 공간을 뺐다 → 내용이 줄면 그 값이 커져 서가가 70px로 쪼그라듦
       *     · `main.bottom`을 아래 경계로 썼다 → main은 내용과 함께 늘어나 경계도 같이 내려가
       *       3칸에 고정된 채 화면을 넘음
       *    그래서 아래 경계는 **화면(뷰포트) 기준**으로만 잡는다.
       */
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const nav = document.querySelector<HTMLElement>('nav.nav-bar');
      const navH = nav?.getBoundingClientRect().height ?? 0;
      const contentBottom = vh - navH;
      const fr = frameEl.getBoundingClientRect();
      const belowFrame = Math.max(0, container.getBoundingClientRect().bottom - fr.bottom);
      const avail = contentBottom - fr.top - belowFrame;

      const rows = Math.max(1, Math.floor(avail / SHELF_ROW_H));
      setShelfFillRows(rows);
      // 남는 자투리는 칸들이 나눠 가진다 — 안 그러면 서가 아래에 빈 배경이 남아
      // "채워진 책장"이 아니라 "잘린 책장"으로 보인다.
      // rows는 avail을 207로 나눈 몫이라 floor(avail/rows) ≥ 207, 즉 rowH ≥ 184가 보장된다.
      setShelfFillRowH(Math.floor(avail / rows) - SHELF_CHROME);
    };
    // 프레임은 로딩 중에는 렌더되지 않는다 → 첫 실행에서 ref가 null이면 조용히 빠진다.
    // 다음 프레임에 한 번 더 재고, 레이아웃이 바뀔 때마다 다시 잰다.
    // avail은 프레임 높이와 무관하므로 몇 번 재도 같은 값이 나온다(되먹임 없음).
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    const container = bookcaseRef.current;
    const ro = container ? new ResizeObserver(measure) : null;
    if (container && ro) ro.observe(container);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [viewMode, shelfGroups.length, loading, txLoading]);

  const emptyShelvesNeeded = Math.max(0, shelfFillRows - shelfGroups.length);

  const statusFilterLabels: Record<StatusFilter, string> = {
    // 한 줄에 네 개가 다 들어가야 해서 짧게 쓴다 — '대여 가능'·'판매중'은 옆으로 밀려
    // 스크롤해야 보였다. 뜻은 그대로다(대여 = 빌릴 수 있는 책).
    all: '전체',
    available: '대여',
    giving: '나눔',
    selling: '판매',
    rented: '대여중',
  };

  // 상태 필터는 헤더 칩으로 눈에 보이므로 뱃지에서 세지 않는다.
  // 뱃지는 "시트 안에 숨어 있는 필터가 몇 개 켜져 있나"만 알려야 한다.
  const activeFilterCount =
    (sortBy !== 'newest' ? 1 : 0) +
    (selectedDistricts.length > 0 ? 1 : 0) +
    (selectedStations.length > 0 ? 1 : 0) +
    (selectedGenres.length > 0 ? 1 : 0);

  return (
    <div className="flex flex-col min-h-full relative">
      {/* Header — 페이지 스크롤 시 상단(앱 헤더 아래)에 고정 */}
      <header
        className="flex flex-col gap-1 px-5 pt-4 pb-3 bg-background/85 backdrop-blur-md sticky sticky-under-header z-30 border-b border-border/40"
      >
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
              <h1 className="font-display text-[30px] leading-none text-foreground mt-1 flex items-center gap-1.5">
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
                  <div className="px-2 py-1.5 text-[13px] uppercase tracking-widest text-muted-foreground font-bold">내 커뮤니티</div>
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
              className="tap-44 w-9 h-9 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center shrink-0"
              title="거래 현황"
            >
              <History className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>

        {/* 검색은 평소엔 돋보기 아이콘으로만 접어둔다 (아래 컨트롤 줄에 있다).
            항상 펼쳐 두면 헤더가 한 줄 더 두꺼워지는데, 검색은 매번 쓰는 기능이 아니다. */}
        {searchOpen && (
          <div className="search-underline">
            <Search className="w-[17px] h-[17px] text-foreground shrink-0" strokeWidth={1.75} />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="제목 또는 저자 검색"
              className="input-search"
            />
            <button
              onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
              className="shrink-0" aria-label="검색 닫기"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          </div>
        )}

        {/* 컨트롤 한 줄 — 장르 · 검색 · 보기방식 · 정밀필터.
            상태(전체·대여·나눔·판매)는 필터 시트 안으로 옮겼다. 네 칸이 늘 자리를 차지하는데
            대부분 '전체'로 두고 쓰기 때문이다. 대신 자주 바뀌는 장르를 밖으로 꺼냈다. */}
        {/* 알약·원형 테두리를 걷어내고 검색창과 같은 밑줄 언어로 통일했다.
            밑줄이 한 선으로 이어지도록 items-end 로 아래를 맞춘다. */}
        <div className="flex items-end gap-2">
          {/* 장르 — 밖으로 꺼낸 드롭다운. 책이 있는 장르만 나온다. */}
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setGenreBarOpen(v => !v)}
              aria-expanded={genreBarOpen}
              className={`w-full h-9 flex items-end justify-between gap-2 px-0.5 pb-1.5 text-[14px] bg-transparent border-0 border-b-[1.5px] transition-colors ${
                selectedGenres.length > 0
                  ? 'border-primary text-primary font-semibold'
                  : 'border-foreground text-foreground font-medium'
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <Tag className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span className="truncate">
                  {selectedGenres.length === 0 ? '장르' : selectedGenres.join(', ')}
                </span>
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${genreBarOpen ? 'rotate-180' : ''}`} />
            </button>

            {genreBarOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border border-border bg-card shadow-hip overflow-hidden">
                {/* 전체 선택/해제 — 장르가 늘수록 하나씩 끄는 게 번거롭다 */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/40">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-faint">장르</span>
                  <button
                    type="button"
                    onClick={() => {
                      const all = GENRES.filter(g => (genreCounts.get(g) ?? 0) > 0);
                      // 이미 다 골랐으면 해제, 아니면 전부 선택 — 버튼 하나로 양쪽을 오간다
                      setSelectedGenres(selectedGenres.length === all.length ? [] : all);
                    }}
                    className="text-[12px] font-semibold text-primary hover:underline"
                  >
                    {selectedGenres.length === GENRES.filter(g => (genreCounts.get(g) ?? 0) > 0).length
                      ? '전체 해제' : '전체 선택'}
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {GENRES.filter(g => (genreCounts.get(g) ?? 0) > 0).map(g => {
                    const on = selectedGenres.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setSelectedGenres(prev => on ? prev.filter(x => x !== g) : [...prev, g])}
                        className={`w-full min-h-11 flex items-center gap-2 px-3 py-2.5 text-[13px] text-left transition-colors ${
                          on ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/60 text-foreground/80'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-primary border-primary' : 'border-border'}`}>
                          {on && (
                            <svg className="w-2 h-2 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="truncate">{g}</span>
                        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums shrink-0">{genreCounts.get(g)}권</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 검색 — 아이콘만. 누르면 위에 입력칸이 펼쳐진다 */}
          <button
            onClick={() => setSearchOpen(v => !v)}
            aria-label="검색"
            aria-expanded={searchOpen}
            className={`tap-44 w-9 h-9 shrink-0 flex items-center justify-center pb-1.5 transition-colors ${
              searchOpen || searchQuery ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Search className="w-[18px] h-[18px]" strokeWidth={1.75} />
          </button>

          {/* 책등 · 표지 · 지도 — 세 모드가 다 보이는 세그먼트 토글(현재 모드가 채워져 보임) */}
          <div
            role="group"
            aria-label="보기 방식"
            data-onboarding="view-toggle"
            className="flex items-end shrink-0 gap-0.5"
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
                className={`tap-44 w-7 h-9 flex items-end justify-center pb-1.5 border-b-[1.5px] transition-colors ${
                  viewMode === key
                    ? 'text-primary border-primary'
                    : 'text-faint hover:text-foreground border-transparent'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </button>
            ))}
          </div>

          {/* 정밀 필터 (지역·정렬) */}
          <button
            onClick={() => setShowFilterSheet(true)}
            data-onboarding="filter"
            className={`tap-44 relative w-9 h-9 shrink-0 flex items-center justify-center pb-1.5 transition-colors ${
              activeFilterCount > 0 ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label="상세 필터"
          >
            <SlidersHorizontal className="w-[18px] h-[18px]" strokeWidth={1.75} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-0.5 -right-1 w-[15px] h-[15px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
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
                  ref={shelfFrameRef}
                  data-onboarding="shelf"
                  // 표지 보기도 책등과 같은 서가 프레임을 쓴다(F18).
                  // 표지만 허공에 떠 있으면 '책장'으로 안 읽힌다.
                  className="relative shelf-vignette overflow-hidden rounded-lg"
                >
                  {viewMode === 'cover' ? (
                    // 결과가 0건이면 빈 선반만 그린다 — 표지 보기에서도 서가 틀은 남아야 한다
                    coverSections.length === 0 ? (
                      Array.from({ length: shelfFillRows }).map((_, i) => (
                        <CoverShelf key={`empty-cover-${i}`}>
                          <div style={{ height: shelfFillRowH }} />
                        </CoverShelf>
                      ))
                    ) : (
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
                    )
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
                            duplicateCount={mixedDuplicateCounts.get(book.id)}
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
                                  className="absolute left-1/2 -translate-x-1/2 bottom-1 text-[11px] tracking-tight text-muted-foreground bg-background px-0.5"
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
                    <EditorialShelf key={`empty-${i}`} bookAreaH={shelfFillRowH}>
                      <div className="h-full" />
                    </EditorialShelf>
                  ))}
                    </>
                  )}

                  {/* 결과 없음 — 필터/검색으로 0건일 때.
                      서가 **위에 겹쳐서** 띄운다. 아래에 두면 서가가 위쪽 조각으로 남고
                      화면 아래가 비어 "책장이 비었다"가 아니라 "화면이 깨졌다"로 읽힌다.
                      pointer-events-none: 뒤 서가의 스크롤·드래그를 막지 않는다. */}
                  {showNoResults && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-5 pointer-events-none [&>*]:pointer-events-auto"
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
                      {(statusFilter !== 'all' || selectedDistricts.length > 0 || selectedStations.length > 0 || selectedGenres.length > 0) && (
                        <button
                          onClick={() => { setStatusFilter('all'); setSelectedDistricts([]); setSelectedStations([]); setSelectedGenres([]); }}
                          className="mt-3 text-xs font-semibold text-primary underline underline-offset-2"
                        >
                          필터 초기화
                        </button>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* 예시 화면 안내 배너는 없앴다 — 책 카드마다 '예시' 배지가 붙어 있어
                    오해할 일이 없고, 첫 화면에 설명문이 먼저 보이는 게 더 거슬렸다. */}

              </motion.div>
        )}
      </div>

      {/* Heart FAB */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-[4.5rem] right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
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

            {/* 책 상태 — 헤더에서 여기로 옮겼다.
                네 칸이 늘 헤더 한 줄을 차지했는데 대부분 '전체'로 두고 쓴다. */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">거래 방식</p>
              <div className="grid grid-cols-4 gap-2">
                {(['all', 'available', 'giving', 'selling'] as StatusFilter[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`chip ${statusFilter === key ? 'chip-active' : ''}`}
                  >
                    {statusFilterLabels[key]}
                  </button>
                ))}
              </div>
            </div>

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
                              {station.name}
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
                            className="tap-44 shrink-0 p-1.5 -mr-1"
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
                          <span className={`ml-auto text-[11px] shrink-0 ${dCount > 0 ? 'text-muted-foreground' : 'text-faint'}`}>
                            {dCount > 0 ? dCount : ''}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFavDistrict(d)}
                          aria-label={dFaved ? `${d} 즐겨찾기 해제` : `${d} 즐겨찾기`}
                          aria-pressed={dFaved}
                          className="tap-44 shrink-0 p-1.5 -mr-1"
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
                onClick={() => { setStatusFilter('all'); setSortBy('newest'); setSelectedDistricts([]); setSelectedStations([]); setSelectedGenres([]); }}
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
