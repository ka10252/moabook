import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Book, transformDbBook } from '@/types/book';

interface UseBooksOptions {
  communityId?: string | null;
  onlyMine?: boolean;
  onlyPublic?: boolean;
}

export const useBooks = (options: UseBooksOptions = {}) => {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('books')
        .select(`
          *,
          profile:profiles!books_owner_id_fkey(nickname, avatar_url),
          community:communities(name)
        `)
        .order('created_at', { ascending: false });

      // Filter by community
      if (options.communityId) {
        query = query.eq('community_id', options.communityId);
      }

      // Only show user's books
      if (options.onlyMine && user) {
        query = query.eq('owner_id', user.id);
      }

      // Only public books
      if (options.onlyPublic) {
        query = query.eq('is_public', true);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const transformedBooks = (data || []).map(transformDbBook);
      setBooks(transformedBooks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load books');
    } finally {
      setLoading(false);
    }
  }, [user?.id, options.communityId, options.onlyMine, options.onlyPublic]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const deleteBook = async (bookId: string) => {
    const { error } = await supabase
      .from('books')
      .delete()
      .eq('id', bookId);

    if (!error) {
      await fetchBooks();
    }
    return { error };
  };

  const updateBook = async (bookId: string, updates: Partial<Book>) => {
    const { error } = await supabase
      .from('books')
      .update({
        title: updates.title,
        author: updates.author,
        description: updates.description,
        cover_url: updates.cover,
        condition: updates.condition,
        mode: updates.mode,
        price: updates.price,
        is_public: updates.is_public,
        community_id: updates.community_id,
      })
      .eq('id', bookId);

    if (!error) {
      await fetchBooks();
    }
    return { error };
  };

  return {
    books,
    loading,
    error,
    refresh: fetchBooks,
    deleteBook,
    updateBook,
  };
};

// Hook for fetching borrowed books (transactions)
export const useBorrowedBooks = () => {
  const { user } = useAuth();
  const [borrowedBooks, setBorrowedBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBorrowedBooks([]);
      setLoading(false);
      return;
    }

    const fetchBorrowed = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          book:books(
            *,
            profile:profiles!books_owner_id_fkey(nickname)
          )
        `)
        .eq('borrower_id', user.id)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false });

      if (!error && data) {
        setBorrowedBooks(data.map(t => ({
          ...t,
          book: t.book ? transformDbBook(t.book) : null,
        })));
      }
      setLoading(false);
    };

    fetchBorrowed();
  }, [user?.id]);

  return { borrowedBooks, loading };
};
