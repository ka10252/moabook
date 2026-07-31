import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DefaultBookCover } from '@/components/DefaultBookCover';
import { useBackClose } from '@/hooks/useBackClose';
import type { ReadingBook } from '@/components/virtual/LibraryScene';

interface ReadingBookModalProps {
  book: ReadingBook;
  onClose: () => void;
}

interface BookInfo {
  title: string;
  author: string | null;
  cover_url: string | null;
  description: string | null;
}

/** 가상공간에서 캐릭터 머리 위 "읽는 책" 표지를 눌렀을 때 뜨는 간단한 책 소개 모달. */
export const ReadingBookModal = ({ book, onClose }: ReadingBookModalProps) => {
  // 우리 books 테이블의 책이면 최신 정보를 가져오고, 검색으로 지정한 임의의 책이면 스냅샷을 그대로 쓴다.
  const snapshot: BookInfo = {
    title: book.title,
    author: book.author ?? null,
    cover_url: book.coverUrl ?? null,
    description: book.description ?? null,
  };
  const [info, setInfo] = useState<BookInfo>(snapshot);
  const [loading, setLoading] = useState(!!book.id);

  useBackClose(true, onClose);

  useEffect(() => {
    if (!book.id) return; // 임의의 책 → 스냅샷 사용, DB 조회 불필요
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('books')
        .select('title, author, cover_url, description')
        .eq('id', book.id)
        .maybeSingle();
      if (!cancelled) {
        if (data) setInfo(data as BookInfo);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [book.id]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/45 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-sm bg-card rounded-3xl p-6 shadow-2xl"
          initial={{ scale: 0.92, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 16 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start mb-4">
            <p className="eyebrow">NOW READING</p>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-muted-foreground hover:bg-muted transition-colors -mt-1 -mr-1"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-4">
            <div className="w-24 shrink-0 aspect-[2/3] rounded-lg overflow-hidden shadow-md bg-muted">
              {info.cover_url ? (
                <img src={info.cover_url} alt={info.title} className="w-full h-full object-cover" />
              ) : (
                <DefaultBookCover title={info.title} author={info.author ?? ''} className="w-full h-full" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl leading-tight text-foreground">{info.title}</h2>
              {info.author && <p className="text-sm text-muted-foreground mt-0.5">{info.author}</p>}
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> 불러오는 중…
                </div>
              ) : info.description ? (
                <p className="text-[13px] text-foreground/80 leading-relaxed mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {info.description}
                </p>
              ) : (
                <p className="text-[13px] text-muted-foreground mt-3">소개가 아직 없어요.</p>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
