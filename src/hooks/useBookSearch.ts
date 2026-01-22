import { useState, useCallback } from 'react';

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

interface AladinItem {
  title: string;
  author: string;
  cover: string;
  description: string;
  isbn13: string;
  pubDate: string;
}

export const useBookSearch = () => {
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      title: doc.title,
      author: doc.author_name?.[0] || 'Unknown Author',
      cover: doc.cover_i 
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : null,
      description: null,
      firstPublishYear: doc.first_publish_year,
      isbn: doc.isbn?.[0],
    }));
  };

  // Search using Google Books API (has Korean book support)
  const searchGoogleBooks = async (query: string): Promise<BookSearchResult[]> => {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8&langRestrict=ko`
    );

    if (!response.ok) throw new Error('Failed to search Korean books');

    const data = await response.json();
    
    if (!data.items) return [];

    return data.items.map((item: { id: string; volumeInfo: { title: string; authors?: string[]; imageLinks?: { thumbnail?: string }; description?: string; publishedDate?: string; industryIdentifiers?: { type: string; identifier: string }[] } }) => ({
      key: item.id,
      title: item.volumeInfo.title,
      author: item.volumeInfo.authors?.[0] || 'Unknown Author',
      cover: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
      description: item.volumeInfo.description || null,
      firstPublishYear: item.volumeInfo.publishedDate ? parseInt(item.volumeInfo.publishedDate.split('-')[0]) : undefined,
      isbn: item.volumeInfo.industryIdentifiers?.find((id: { type: string }) => id.type === 'ISBN_13')?.identifier,
    }));
  };

  const searchBooks = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      let books: BookSearchResult[];
      
      // Use Google Books for Korean queries, Open Library otherwise
      if (containsKorean(query)) {
        books = await searchGoogleBooks(query);
        // If no Korean results, try Open Library as fallback
        if (books.length === 0) {
          books = await searchOpenLibrary(query);
        }
      } else {
        // For non-Korean, search both and combine
        const [openLibResults, googleResults] = await Promise.all([
          searchOpenLibrary(query).catch(() => []),
          searchGoogleBooks(query).catch(() => []),
        ]);
        
        // Prioritize Open Library results but add unique Google results
        const seenTitles = new Set(openLibResults.map(b => b.title.toLowerCase()));
        const uniqueGoogleResults = googleResults.filter(b => !seenTitles.has(b.title.toLowerCase()));
        books = [...openLibResults, ...uniqueGoogleResults].slice(0, 10);
      }

      setResults(books);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const fetchBookDetails = useCallback(async (key: string): Promise<string | null> => {
    // Check if it's a Google Books ID (not starting with /)
    if (!key.startsWith('/')) {
      try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes/${key}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.volumeInfo?.description || null;
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
        return data.description;
      } else if (data.description?.value) {
        return data.description.value;
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
