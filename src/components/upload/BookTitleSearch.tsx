import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, Book } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BookSearchResult, useBookSearch } from '@/hooks/useBookSearch';
import { cn } from '@/lib/utils';

interface BookTitleSearchProps {
  /** 현재 제목 값 (부모의 formData.title). 검색을 안 하고 직접 타이핑해도 이게 제목이 된다. */
  title: string;
  /** 타이핑으로 제목이 바뀔 때 */
  onTitleChange: (title: string) => void;
  /** 검색 결과에서 책을 골랐을 때 — 부모가 저자·설명·표지를 채운다 */
  onBookSelect: (book: BookSearchResult) => void;
  /** 매칭된 책의 표지(확인용 썸네일). 없으면 책 아이콘 */
  matchedCover?: string | null;
  /** 매칭 여부 — true면 "이 책으로 채웠어요" 상태 */
  matched?: boolean;
}

/**
 * 제목 입력 = 검색.
 *
 * 예전엔 "책 검색" 칸과 "책 제목" 칸이 따로 있어서 뭐가 다른지 헷갈렸다(개발자도 헷갈렸다).
 * 이제 칸 하나다. 입력하면 검색 결과가 아래에 뜨고, 고르면 정보가 채워지고,
 * 결과가 없거나 무시하면 입력한 텍스트가 그대로 제목이 된다.
 */
export const BookTitleSearch = ({
  title,
  onTitleChange,
  onBookSelect,
  matchedCover,
  matched,
}: BookTitleSearchProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { results, isSearching, searchBooks, clearResults } = useBookSearch();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  // 방금 결과를 골랐으면, 그 선택이 채운 제목으로 곧바로 재검색하지 않는다.
  const justSelectedRef = useRef(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    debounceRef.current = setTimeout(() => {
      if (title.trim().length >= 2) {
        searchBooks(title.trim());
        setIsOpen(true);
      } else {
        clearResults();
        setIsOpen(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title, searchBooks, clearResults]);

  // 바깥을 누르면 결과 목록을 닫는다 (제목 값은 그대로 유지 = 수동 입력)
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleSelect = (book: BookSearchResult) => {
    justSelectedRef.current = true;
    onBookSelect(book);
    setIsOpen(false);
    clearResults();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center gap-2">
        {/* 매칭된 책이면 표지 썸네일로 "채워졌다"는 걸 보여준다 */}
        {matched &&
          (matchedCover ? (
            <img
              src={matchedCover}
              alt=""
              className="w-9 h-12 object-cover rounded-md shadow-sm shrink-0"
            />
          ) : (
            <div className="w-9 h-12 bg-muted rounded-md flex items-center justify-center shrink-0">
              <Book className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="책 제목을 입력하세요"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onFocus={() => results.length > 0 && setIsOpen(true)}
            className="pl-9 pr-9 h-11 text-[15px] bg-card border-border rounded-xl"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute z-50 w-full mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
          >
            <ul className="max-h-80 overflow-y-auto">
              {results.map((book, i) => (
                <li key={book.key}>
                  <button
                    type="button"
                    onClick={() => handleSelect(book)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left',
                      i !== results.length - 1 && 'border-b border-border'
                    )}
                  >
                    {book.cover ? (
                      <img
                        src={book.cover}
                        alt=""
                        className="w-10 h-14 object-cover rounded shadow-sm shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-14 bg-muted rounded flex items-center justify-center shrink-0">
                        <Book className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-[15px] truncate">{book.title}</p>
                      <p className="text-[14px] text-muted-foreground truncate">
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
