import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, Book, X, PenLine } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BookSearchResult, useBookSearch } from '@/hooks/useBookSearch';
import { cn } from '@/lib/utils';

interface WishlistBookSearchProps {
  onBookSelect: (title: string, author: string | null) => void;
  onManualEntry: () => void;
}

export const WishlistBookSearch = ({ onBookSelect, onManualEntry }: WishlistBookSearchProps) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { results, isSearching, searchBooks, clearResults } = useBookSearch();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

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
    onBookSelect(book.title, book.author);
    setQuery('');
    setIsOpen(false);
    clearResults();
  };

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="책 제목을 검색하세요 (한글 지원)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="pl-10 pr-10 h-12 bg-muted border-0 rounded-xl"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Manual entry button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onManualEntry}
        className="text-muted-foreground hover:text-foreground gap-2"
      >
        <PenLine className="w-4 h-4" />
        찾는 책이 없나요? 직접 입력하기
      </Button>

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