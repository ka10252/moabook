import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Loader2, Library, LayoutGrid, Map as MapIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BookCover } from '@/components/BookCover';
import { BookSpine } from '@/components/BookSpine';
import { EditorialShelf } from '@/components/EditorialShelf';
import { CoverShelf } from '@/components/CoverShelf';
import { BookMapView } from '@/components/BookMapView';
import { transformDbBook, type Book } from '@/types/book';
import { cn } from '@/lib/utils';

interface Props {
  communityId: string;
  communityName: string;
  onBack: () => void;
  onBookClick: (book: Book) => void;
}

type ShelfView = 'spine' | 'cover' | 'map';

/**
 * 커뮤니티 팝업 안에서 그 커뮤니티의 책장을 본다(F15).
 * 보기 방식은 서가 탭과 같은 3종(책등·표지·지도).
 */
export const CommunityShelfPanel = ({ communityId, communityName, onBack, onBookClick }: Props) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ShelfView>('cover');

  // 책등 한 칸에 몇 권 들어가는지 — 팝업은 서가 탭보다 좁아서 따로 재야 한다
  const frameRef = useRef<HTMLDivElement>(null);
  const [perShelf, setPerShelf] = useState(4);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const calc = (w: number) => setPerShelf(Math.max(2, Math.floor((w + 6) / 58)));
    const ro = new ResizeObserver((e) => e[0] && calc(e[0].contentRect.width));
    ro.observe(el);
    calc(el.clientWidth);
    return () => ro.disconnect();
  }, [view]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);

      // 커뮤니티 책장 = ① 이 커뮤니티에 '공개'로 지정된 커뮤니티 전용 책
      //              + ② 멤버들의 전체공개 책(이 커뮤니티에서 '숨김'이 아닌 것)
      // ②를 빠뜨리면 대부분의 커뮤니티가 빈 책장으로 보인다 — 사람들은 보통
      // 책을 '전체 공개'로 올리지 커뮤니티 전용으로 올리지 않기 때문이다.
      // 서가 탭의 커뮤니티 필터가 쓰는 규칙과 같아야 한다(Bookshelf의 filteredBooks).
      const { data: memberRows } = await supabase
        .from('community_members')
        .select('user_id')
        .eq('community_id', communityId)
        .eq('is_banned', false);
      const memberIds = (memberRows ?? []).map((r) => (r as { user_id: string }).user_id);

      const cols = `
        id, title, author, cover_url, condition, mode, price, description,
        is_public, community_id, owner_id, status, created_at, updated_at, hidden_at,
        profile:profiles!books_owner_id_fkey(nickname, avatar_url), community:communities(name)
      `;

      // 이 커뮤니티에 대한 공개/숨김 설정 (마이그 20260820000001)
      const { data: visRows } = await supabase
        .from('book_community_visibility' as never)
        .select('book_id, visible')
        .eq('community_id', communityId);
      const vis = new Map<string, boolean>(
        ((visRows ?? []) as unknown as { book_id: string; visible: boolean }[])
          .map((r) => [r.book_id, r.visible]),
      );

      const [assigned, memberPublic] = await Promise.all([
        // 커뮤니티 전용 책 — 이 커뮤니티가 '공개'로 지정된 것만
        supabase.from('books').select(cols).eq('is_public', false),
        memberIds.length
          ? supabase.from('books').select(cols).eq('is_public', true).in('owner_id', memberIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!alive) return;

      // 관리자가 숨긴 책은 서비스 화면에서 제외한다(useBooks 와 같은 규칙).
      // RLS는 관리자에게 숨긴 책도 내주므로, 안 거르면 관리자만 다르게 보인다.
      const byId = new Map<string, Book>();
      for (const row of [...(assigned.data ?? []), ...(memberPublic.data ?? [])]) {
        const r = row as { hidden_at?: string | null; id: string; is_public: boolean };
        // 관리자가 숨긴 책은 서비스 화면에서 제외한다(useBooks 와 같은 규칙)
        if (r.hidden_at) continue;
        // 커뮤니티 전용 = 이 커뮤니티가 '공개'로 들어 있을 때만
        // 전체공개    = 기본 노출, 단 '숨김'으로 들어 있으면 제외
        const flag = vis.get(r.id);
        if (r.is_public ? flag === false : flag !== true) continue;
        const book = transformDbBook(row as never);
        byId.set(book.id, book);
      }
      setBooks(
        [...byId.values()].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [communityId]);

  const chunk = (n: number) => {
    const out: Book[][] = [];
    for (let i = 0; i < books.length; i += n) out.push(books.slice(i, i + n));
    return out;
  };

  const VIEWS: { id: ShelfView; icon: typeof Library; label: string }[] = [
    { id: 'spine', icon: Library, label: '책등으로 보기' },
    { id: 'cover', icon: LayoutGrid, label: '표지로 보기' },
    { id: 'map', icon: MapIcon, label: '지도로 보기' },
  ];

  return (
    // min-h-0 이 없으면 아래 스크롤 영역이 팝업 높이를 넘어 자라서 스크롤이 안 생긴다
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
        <button onClick={onBack} aria-label="뒤로" className="tap-44 p-1 -m-1 text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium truncate">
          {communityName} 책장 {!loading && `(${books.length})`}
        </span>

        <div className="ml-auto flex items-center gap-0.5 bg-muted rounded-full p-0.5 shrink-0">
          {VIEWS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              aria-label={label}
              className={cn(
                'tap-44 p-1.5 rounded-full transition-colors',
                view === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">아직 등록된 책이 없습니다</p>
          </div>
        ) : view === 'map' ? (
          <div className="h-full min-h-[380px]">
            <BookMapView books={books} onSelectBook={onBookClick} />
          </div>
        ) : (
          <div className="p-3">
            <div ref={frameRef} className="shelf-vignette overflow-hidden rounded-lg">
              {view === 'cover'
                ? chunk(3).map((row, i) => (
                    <CoverShelf key={i}>
                      {row.map((book) => (
                        <BookCover key={book.id} book={book} onClick={() => onBookClick(book)} />
                      ))}
                    </CoverShelf>
                  ))
                : chunk(perShelf).map((row, i) => (
                    <EditorialShelf key={i}>
                      {row.map((book) => (
                        <BookSpine
                          key={book.id}
                          book={book}
                          onClick={() => onBookClick(book)}
                          isSelected={false}
                          isLent={false}
                          isBorrowed={false}
                        />
                      ))}
                    </EditorialShelf>
                  ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
