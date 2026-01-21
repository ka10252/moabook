import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, Book, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BookSearchResult, useBookSearch } from '@/hooks/useBookSearch';
import { cn } from '@/lib/utils';

interface BookSearchInputProps {
  onBookSelect: (book: BookSearchResult) => void;
  selectedBook: BookSearchResult | null;
  onClear: () => void;
}

export const BookSearchInput = ({ onBookSelect, selectedBook, onClear }: BookSearchInputProps) => {
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
    onBookSelect(book);
    setQuery('');
    setIsOpen(false);
    clearResults();
  };

  if (selectedBook) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-3 p-3 bg-secondary rounded-xl border border-border"
      >
        {selectedBook.cover ? (
          <img 
            src={selectedBook.cover} 
            alt={selectedBook.title}
            className="w-12 h-16 object-cover rounded-md shadow-sm"
          />
        ) : (
          <div className="w-12 h-16 bg-muted rounded-md flex items-center justify-center">
            <Book className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{selectedBook.title}</p>
          <p className="text-sm text-muted-foreground truncate">{selectedBook.author}</p>
        </div>
        <button
          onClick={onClear}
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </motion.div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by book title..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="pl-10 pr-10 h-12 bg-secondary border-border rounded-xl"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
        )}
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
          >
            <ul className="max-h-80 overflow-y-auto">
              {results.map((book, index) => (
                <li key={book.key}>
                  <button
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
