import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, Book, X, PenLine } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BookSearchResult, useBookSearch } from '@/hooks/useBookSearch';
import { warmBookSearch } from '@/hooks/useBookSearch';
import { cn } from '@/lib/utils';

interface WishlistBookSearchProps {
  onBookSelect: (title: string, author: string | null, cover: string | null) => void;
  onManualEntry: () => void;
}

export const WishlistBookSearch = ({ onBookSelect, onManualEntry }: WishlistBookSearchProps) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { results, isSearching, searchBooks, clearResults } = useBookSearch();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // 검색창이 뜨자마자 알라딘 함수를 깨워둔다. 제목을 치는 동안 콜드 스타트가 끝난다.
  useEffect(() => { warmBookSearch(); }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (query.length >= 2) {
        searchBooks(query);
        setIsOpen(true);
      } else {
        clearResults();
        setIsOpen(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, searchBooks, clearResults]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (book: BookSearchResult) => {
    onBookSelect(book.title, book.author, book.cover ?? null);
    setQuery('');
    setIsOpen(false);
    clearResults();
  };

  return (
    <div ref={containerRef} className="relative space-y-2">
      <label className="block text-[13px] font-semibold text-foreground">책 제목</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="책 제목을 입력하세요"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="pl-10 pr-10 h-12 bg-muted border-0 rounded-xl"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* 아직 아무것도 안 고른 상태의 안내.
          "왜 저자·설명을 안 물어보지?"에 먼저 답해줘야 유저가 빈 화면에서 멈추지 않는다. */}
      <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center">
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          위에서 <b className="text-foreground font-semibold">책 제목을 검색해 고르면</b>
          <br />
          저자·설명이 자동으로 채워져요.
        </p>
        <button
          type="button"
          onClick={onManualEntry}
          className="mt-3 text-[13px] font-medium text-primary underline underline-offset-4"
        >
          검색에 없는 책은 직접 입력하기
        </button>
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
          >
            <ul className="max-h-64 overflow-y-auto">
              {results.map((book, index) => (
                <li key={book.key}>
                  <button
                    type="button"
                    onClick={() => handleSelect(book)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left",
                      index !== results.length - 1 && "border-b border-border"
                    )}
                  >
                    {book.cover ? (
                      <img 
                        src={book.cover} 
                        alt={book.title}
                        className="w-10 h-14 object-cover rounded shadow-sm flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-14 bg-muted rounded flex items-center justify-center flex-shrink-0">
                        <Book className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{book.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {book.author}
                        {book.firstPublishYear && ` · ${book.firstPublishYear}`}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};