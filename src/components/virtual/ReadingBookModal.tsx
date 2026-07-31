import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DefaultBookCover } from '@/components/DefaultBookCover';
import { useBackClose } from '@/hooks/useBackClose';

interface ReadingBookModalProps {
  bookId: string;
  onClose: () => void;
}

interface BookInfo {
  title: string;
  author: string;
  cover_url: string | null;
  description: string | null;
}

/** 가상공간에서 캐릭터 머리 위 "읽는 책" 표지를 눌렀을 때 뜨는 간단한 책 소개 모달. */
export const ReadingBookModal = ({ bookId, onClose }: ReadingBookModalProps) => {
  const [book, setBook] = useState<BookInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useBackClose(true, onClose);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('books')
        .select('title, author, cover_url, description')
        .eq('id', bookId)
        .maybeSingle();
      if (!cancelled) {
        setBook((data as BookInfo | null) ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookId]);

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

          {loading ? (
            <div className="h-40 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !book ? (
            <p className="text-sm text-muted-foreground py-8 text-center">책 정보를 찾을 수 없어요.</p>
          ) : (
            <div className="flex gap-4">
              <div className="w-24 shrink-0 aspect-[2/3] rounded-lg overflow-hidden shadow-md bg-muted">
                {book.cover_url ? (
                  <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <DefaultBookCover title={book.title} author={book.author} className="w-full h-full" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl leading-tight text-foreground">{book.title}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{book.author}</p>
                {book.description && (
                  <p className="text-[13px] text-foreground/80 leading-relaxed mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {book.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
