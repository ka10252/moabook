import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BookCover } from '@/components/BookCover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { transformDbBook, type Book } from '@/types/book';

interface Props {
  communityId: string;
  communityName: string;
  onBack: () => void;
  onBookClick: (book: Book) => void;
}

/**
 * 커뮤니티 팝업 안에서 그 커뮤니티의 책장을 본다(F15).
 *
 * 예전엔 메인 서가 탭으로 넘겼는데, 화면이 통째로 바뀌어서
 * "커뮤니티 안의 책장"이 아니라 메인으로 튕긴 것으로 읽혔다.
 */
export const CommunityShelfPanel = ({ communityId, communityName, onBack, onBookClick }: Props) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('books')
        .select(`
          id, title, author, cover_url, condition, mode, price, description,
          is_public, community_id, owner_id, status, created_at, updated_at,
          profile:profiles!books_owner_id_fkey(nickname, avatar_url), community:communities(name)
        `)
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });
      if (!alive) return;
      if (!error) setBooks((data ?? []).map((b) => transformDbBook(b as never)));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [communityId]);

  return (
    <>
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
        <button onClick={onBack} aria-label="뒤로" className="p-1 -m-1 text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium truncate">
          {communityName} 책장 {!loading && `(${books.length})`}
        </span>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">아직 등록된 책이 없습니다</p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-2 gap-4">
            {books.map((book) => (
              <BookCover key={book.id} book={book} onClick={() => onBookClick(book)} />
            ))}
          </div>
        )}
      </ScrollArea>
    </>
  );
};
