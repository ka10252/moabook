import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Loader2, BookOpen, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBookSearch } from '@/hooks/useBookSearch';
import { toast } from 'sonner';
import type { ReadingBook } from '@/components/virtual/LibraryScene';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** 저장 후 씬 말풍선 갱신 */
  onSaved: () => void;
}

/**
 * '지금 읽는 책' 전용 설정 모달.
 * 캐릭터 설정 안에 묻혀 있어 발견이 어렵다는 피드백 → 가상룸 상단에서 바로 여는 독립 화면.
 */
export const ReadingBookPicker = ({ isOpen, onClose, onSaved }: Props) => {
  const { user } = useAuth();
  const { results, isSearching, searchBooks, clearResults } = useBookSearch();
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [myBooks, setMyBooks] = useState<ReadingBook[]>([]);
  const [current, setCurrent] = useState<ReadingBook | null>(null);

  // 기본 옵션: 내가 소유한 책 + 대여 중인 책 (검색 전에 바로 고를 수 있게) + 현재 선택 표시
  useEffect(() => {
    if (!isOpen || !user) return;
    let cancelled = false;
    (async () => {
      const { data: prof } = await supabase.from('profiles').select('reading_book').eq('id', user.id).maybeSingle();
      if (!cancelled) setCurrent((prof as unknown as { reading_book?: ReadingBook | null } | null)?.reading_book ?? null);
      const [owned, borrowed] = await Promise.all([
        supabase.from('books').select('id, title, author, cover_url').eq('owner_id', user.id),
        supabase.from('transactions').select('book:books(id, title, author, cover_url)').eq('borrower_id', user.id).eq('status', 'active'),
      ]);
      if (cancelled) return;
      type BookRow = { id: string; title: string; author?: string | null; cover_url?: string | null };
      const toRB = (b: BookRow): ReadingBook => ({ id: b.id, title: b.title, author: b.author ?? null, coverUrl: b.cover_url ?? null });
      const list: ReadingBook[] = [
        ...((owned.data ?? []) as BookRow[]).map(toRB),
        ...((borrowed.data ?? []) as Array<{ book: BookRow | null }>).map((t) => t.book).filter(Boolean).map((b) => toRB(b!)),
      ];
      setMyBooks(Array.from(new Map(list.map((b) => [b.id, b])).values()));
    })();
    return () => { cancelled = true; };
  }, [isOpen, user]);

  if (!isOpen) return null;

  const searching = query.trim().length >= 2;
  const isCur = (b: ReadingBook) =>
    !!current && ((b.id != null && current.id === b.id) || (!!current.title && current.title === b.title));

  const onQuery = (v: string) => {
    setQuery(v);
    if (v.trim().length >= 2) searchBooks(v.trim());
    else clearResults();
  };

  const save = async (book: ReadingBook | null) => {
    if (!user) return;
    setSaving(true);
    try {
      // reading_book(jsonb 스냅샷) + reading_book_id. 컬럼 없어도 안전하게 폴백.
      let res = await supabase.from('profiles')
        .update({ reading_book: book as never, reading_book_id: book?.id ?? null } as never)
        .eq('id', user.id);
      if (res.error) {
        res = await supabase.from('profiles')
          .update({ reading_book_id: book?.id ?? null } as never)
          .eq('id', user.id);
      }
      if (res.error) throw res.error;
      toast.success(book ? `'${book.title}'(으)로 설정했어요` : '읽는 책을 지웠어요');
      onSaved();
      onClose();
    } catch {
      toast.error('설정에 실패했어요');
    } finally { setSaving(false); }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-4 max-h-[80vh] flex flex-col"
        initial={{ y: 40 }} animate={{ y: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="text-[17px] font-bold text-foreground">지금 읽는 책</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <p className="text-[13px] text-muted-foreground mb-2">캐릭터 머리 위 말풍선에 표지로 보여요.</p>

        {/* 지금 선택된 책 */}
        <div className="flex items-center gap-2 mb-3 px-2.5 py-2 rounded-xl bg-primary/[0.07] border border-primary/25">
          {current ? (
            current.coverUrl
              ? <img src={current.coverUrl} alt="" className="w-7 h-10 object-cover rounded shrink-0 bg-muted" />
              : <div className="w-7 h-10 rounded bg-muted shrink-0" />
          ) : (
            <span className="w-7 h-10 rounded bg-muted shrink-0 flex items-center justify-center"><BookOpen className="w-3.5 h-3.5 text-muted-foreground" /></span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-primary">지금 읽는 책</p>
            <p className="text-[13px] font-medium text-foreground truncate">{current ? current.title : '아직 선택 안 함'}</p>
          </div>
          {current && (
            <button
              onClick={() => save(null)}
              disabled={saving}
              aria-label="읽는 책 지우기"
              className="shrink-0 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="책 제목·저자로 검색"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-muted/50 border-0 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto moa-thin-scroll">
          {/* 검색 전: 내 책 + 대여 중인 책을 기본 옵션으로 */}
          {!searching && myBooks.length > 0 && (
            <>
              <p className="px-2.5 pt-2 pb-1 text-[11px] font-bold text-faint">내 책 · 대여 중인 책</p>
              {myBooks.map((b) => (
                <button
                  key={b.id}
                  onClick={() => save(b)}
                  disabled={saving}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left ${isCur(b) ? 'bg-primary/10' : 'hover:bg-muted/60'}`}
                >
                  {b.coverUrl
                    ? <img src={b.coverUrl} alt="" loading="lazy" className="w-7 h-10 object-cover rounded shrink-0 bg-muted" />
                    : <div className="w-7 h-10 rounded bg-muted shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-medium truncate ${isCur(b) ? 'text-primary' : 'text-foreground'}`}>{b.title}</p>
                    {b.author && <p className="text-[13px] text-muted-foreground truncate">{b.author}</p>}
                  </div>
                  {isCur(b) && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              ))}
            </>
          )}
          {isSearching && results.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-3 text-[13px] text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> 검색 중…</div>
          )}
          {searching && results.map((r) => (
            <button
              key={r.key}
              onClick={() => save({ id: null, title: r.title, author: r.author, coverUrl: r.cover, description: r.description })}
              disabled={saving}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-muted/60 text-left"
            >
              {r.cover
                ? <img src={r.cover} alt="" loading="lazy" className="w-7 h-10 object-cover rounded shrink-0 bg-muted" />
                : <div className="w-7 h-10 rounded bg-muted shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground truncate">{r.title}</p>
                <p className="text-[13px] text-muted-foreground truncate">{r.author}</p>
              </div>
              {saving && <Check className="w-4 h-4 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};
