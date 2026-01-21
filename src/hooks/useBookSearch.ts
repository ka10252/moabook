import { useState, useCallback } from 'react';

export interface BookSearchResult {
  key: string;
  title: string;
  author: string;
  cover: string | null;
  description: string | null;
  firstPublishYear?: number;
}

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
}

export const useBookSearch = () => {
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchBooks = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=key,title,author_name,cover_i,first_publish_year`
      );

      if (!response.ok) {
        throw new Error('Failed to search books');
      }

      const data = await response.json();
      
      const books: BookSearchResult[] = data.docs.map((doc: OpenLibraryDoc) => ({
        key: doc.key,
        title: doc.title,
        author: doc.author_name?.[0] || 'Unknown Author',
        cover: doc.cover_i 
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          : null,
        description: null, // Will fetch separately if needed
        firstPublishYear: doc.first_publish_year,
      }));

      setResults(books);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const fetchBookDetails = useCallback(async (key: string): Promise<string | null> => {
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
