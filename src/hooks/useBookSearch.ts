import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { decodeEntities } from '@/lib/decodeEntities';

export interface BookSearchResult {
  key: string;
  title: string;
  author: string;
  cover: string | null;
  description: string | null;
  firstPublishYear?: number;
  isbn?: string;
}

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  isbn?: string[];
}

/**
 * 어느 소스에서 왔든 화면·DB에 들어가기 전에 한 번 거친다.
 * 소스마다 이스케이프 습관이 달라서(알라딘=제목까지, 구글=소개 위주) 개별로 대응하면 또 샌다.
 */
const sanitize = (r: BookSearchResult): BookSearchResult => ({
  ...r,
  title: decodeEntities(r.title ?? ''),
  author: decodeEntities(r.author ?? ''),
  description: r.description ? decodeEntities(r.description) : null,
});

/**
 * 알라딘 Edge Function 예열.
 *
 * Supabase Edge Function은 한동안 안 부르면 잠든다. 그러면 **그 세션의 첫 검색만**
 * 콜드 스타트를 그대로 뒤집어써서 유독 느리다 — "갑자기 느려졌다"의 정체다.
 * 검색창이 화면에 뜨는 순간(=글자를 치기 전) 빈 질의를 한 번 보내 깨워두면,
 * 그 대기 시간이 사용자가 제목을 입력하는 시간과 겹쳐 사라진다.
 * 질의가 2글자 미만이면 함수는 알라딘을 부르지 않고 즉시 빈 배열을 준다 — 한도를 쓰지 않는다.
 */
let warmed = false;
export function warmBookSearch() {
  if (warmed) return;
  warmed = true;
  void supabase.functions.invoke('aladin-search', { body: { query: '' } }).catch(() => {});
}

export const useBookSearch = () => {
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 요청 순번 — 결과를 '도착하는 대로' 여러 번 setResults 할 때, 늦게 온 옛 검색이
  // 최신 검색 결과를 덮어쓰지 않게 막는다.
  const reqIdRef = useRef(0);

  // Detect if query contains Korean characters
  const containsKorean = (text: string) => /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text);

  // Search using Open Library (better for international/English books)
  const searchOpenLibrary = async (query: string): Promise<BookSearchResult[]> => {
    const response = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=key,title,author_name,cover_i,first_publish_year,isbn`
    );

    if (!response.ok) throw new Error('Failed to search books');

    const data = await response.json();
    
    return data.docs.map((doc: OpenLibraryDoc) => ({
      key: doc.key,
      title: decodeEntities(doc.title),
      author: decodeEntities(doc.author_name?.[0] || '') || 'Unknown Author',
      cover: doc.cover_i 
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : null,
      description: null,
      firstPublishYear: doc.first_publish_year,
      isbn: doc.isbn?.[0],
    }));
  };

  // 한국 책은 알라딘이 압도적으로 정확하다 (표지·저자·소개).
  // CORS 때문에 브라우저에서 직접 못 부르므로 Edge Function을 거친다.
  const searchAladin = async (query: string): Promise<BookSearchResult[]> => {
    const { data, error } = await supabase.functions.invoke('aladin-search', {
      body: { query },
    });
    if (error) throw error;
    // Edge Function은 항상 { results: [...] } 를 준다 (실패해도 빈 배열).
    return ((data?.results ?? []) as BookSearchResult[]).map(sanitize);
  };

  // Search using Google Books API (has Korean book support)
  const searchGoogleBooks = async (query: string): Promise<BookSearchResult[]> => {
    const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
    const keyParam = apiKey ? `&key=${apiKey}` : '';
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8&langRestrict=ko${keyParam}`
    );

    if (!response.ok) throw new Error('Failed to search Korean books');

    const data = await response.json();
    
    if (!data.items) return [];

    return data.items.map((item: { id: string; volumeInfo: { title: string; authors?: string[]; imageLinks?: { thumbnail?: string; small?: string; medium?: string }; description?: string; publishedDate?: string; industryIdentifiers?: { type: string; identifier: string }[] } }) => {
      const imageLinks = item.volumeInfo.imageLinks;
      const rawCover = imageLinks?.medium || imageLinks?.small || imageLinks?.thumbnail || null;
      const cover = rawCover
        ? rawCover.replace('http:', 'https:').replace('zoom=1', 'zoom=0').replace('&edge=curl', '')
        : null;
      return ({
      key: item.id,
      title: decodeEntities(item.volumeInfo.title),
      author: decodeEntities(item.volumeInfo.authors?.[0] || '') || 'Unknown Author',
      cover,
      description: item.volumeInfo.description ? decodeEntities(item.volumeInfo.description) : null,
      firstPublishYear: item.volumeInfo.publishedDate ? parseInt(item.volumeInfo.publishedDate.split('-')[0]) : undefined,
      isbn: item.volumeInfo.industryIdentifiers?.find((id: { type: string }) => id.type === 'ISBN_13')?.identifier,
    });
  });
  };

  const searchBooks = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    const myReq = ++reqIdRef.current;
    const isLatest = () => reqIdRef.current === myReq;
    setIsSearching(true);
    setError(null);

    // 도착하는 대로 화면에 반영 — 소스별로 먼저 온 결과를 즉시 보여주고, 뒤이어 합쳐 채운다.
    // (기존엔 두 소스를 Promise.all로 다 기다린 뒤 한 번에 보여줘 느리게 느껴졌다.)
    const merge = (a: BookSearchResult[], b: BookSearchResult[]) => {
      const seen = new Set(a.map((x) => x.title.toLowerCase()));
      return [...a, ...b.filter((x) => !seen.has(x.title.toLowerCase()))].slice(0, 10);
    };

    try {
      if (containsKorean(query)) {
        // 한글 → 알라딘 우선(빠름), 없으면 Google로 보완
        const aladin = await searchAladin(query).catch(() => []);
        if (!isLatest()) return;
        if (aladin.length > 0) {
          setResults(aladin.slice(0, 10));
        } else {
          const google = await searchGoogleBooks(query).catch(() => []);
          if (!isLatest()) return;
          setResults(google.slice(0, 10));
        }
      } else {
        // 영문 → 먼저 온 소스를 바로 표시하고, 나머지가 오면 합쳐서 갱신
        let shown: BookSearchResult[] = [];
        await Promise.all([
          searchOpenLibrary(query).catch(() => []).then((r) => {
            if (!isLatest()) return;
            shown = merge(r, shown);
            setResults(shown);
          }),
          searchGoogleBooks(query).catch(() => []).then((r) => {
            if (!isLatest()) return;
            shown = merge(shown, r);
            setResults(shown);
          }),
        ]);
      }
    } catch (err) {
      if (isLatest()) { setError(err instanceof Error ? err.message : 'Search failed'); setResults([]); }
    } finally {
      if (isLatest()) setIsSearching(false);
    }
  }, []);

  const fetchBookDetails = useCallback(async (key: string): Promise<string | null> => {
    // 알라딘 결과는 검색 단계에서 이미 소개를 함께 받았다. 추가 호출이 필요 없다.
    if (key.startsWith('aladin:')) {
      return null;
    }

    // Check if it's a Google Books ID (not starting with /)
    if (!key.startsWith('/')) {
      try {
        const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
        const keyParam = apiKey ? `?key=${apiKey}` : '';
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes/${key}${keyParam}`);
        if (!response.ok) return null;
        const data = await response.json();
        const desc = data.volumeInfo?.description;
        return desc ? decodeEntities(desc) : null;
      } catch {
        return null;
      }
    }

    // Open Library key
    try {
      const response = await fetch(`https://openlibrary.org${key}.json`);
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (typeof data.description === 'string') {
        return decodeEntities(data.description);
      } else if (data.description?.value) {
        return decodeEntities(data.description.value);
      }
      
      return null;
    } catch {
      return null;
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    isSearching,
    error,
    searchBooks,
    fetchBookDetails,
    clearResults,
  };
};
