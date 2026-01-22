import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Book, transformDbBook } from '@/types/book';

interface LikedBookRecord {
  id: string;
  user_id: string;
  book_id: string;
  created_at: string;
  book?: Book;
}

export const useLikedBooks = () => {
  const { user } = useAuth();
  const [likedBooks, setLikedBooks] = useState<LikedBookRecord[]>([]);
  const [likedBookIds, setLikedBookIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchLikedBooks = useCallback(async () => {
    if (!user) {
      setLikedBooks([]);
      setLikedBookIds(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // First fetch liked_books entries
      const { data: likedData, error: likedError } = await supabase
        .from('liked_books' as any)
        .select('id, user_id, book_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (likedError) throw likedError;

      if (!likedData || likedData.length === 0) {
        setLikedBooks([]);
        setLikedBookIds(new Set());
        setLoading(false);
        return;
      }

      // Then fetch the books for those liked entries
      const bookIds = likedData.map((item: any) => item.book_id);
      const { data: booksData, error: booksError } = await supabase
        .from('books')
        .select(`
          id,
          title,
          author,
          cover_url,
          condition,
          mode,
          price,
          description,
          is_public,
          community_id,
          owner_id,
          status,
          created_at,
          updated_at,
          owner:profiles(id, nickname),
          community:communities(id, name)
        `)
        .in('id', bookIds);

      if (booksError) throw booksError;

      const booksMap = new Map<string, Book>();
      (booksData || []).forEach((book: any) => {
        booksMap.set(book.id, transformDbBook(book));
      });

      const transformedData: LikedBookRecord[] = likedData.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        book_id: item.book_id,
        created_at: item.created_at,
        book: booksMap.get(item.book_id),
      }));

      setLikedBooks(transformedData);
      setLikedBookIds(new Set(transformedData.map(item => item.book_id)));
    } catch (err) {
      console.error('Failed to fetch liked books:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchLikedBooks();
  }, [fetchLikedBooks]);

  const isLiked = useCallback((bookId: string) => {
    return likedBookIds.has(bookId);
  }, [likedBookIds]);

  const likeBook = async (bookId: string) => {
    if (!user) return { error: new Error('로그인이 필요합니다') };

    const { error } = await supabase
      .from('liked_books' as any)
      .insert({ user_id: user.id, book_id: bookId } as any);

    if (!error) {
      setLikedBookIds(prev => new Set([...prev, bookId]));
      await fetchLikedBooks();
    }

    return { error };
  };

  const unlikeBook = async (bookId: string) => {
    if (!user) return { error: new Error('로그인이 필요합니다') };

    const { error } = await supabase
      .from('liked_books' as any)
      .delete()
      .eq('user_id', user.id)
      .eq('book_id', bookId);

    if (!error) {
      setLikedBookIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(bookId);
        return newSet;
      });
      await fetchLikedBooks();
    }

    return { error };
  };

  const toggleLike = async (bookId: string) => {
    if (isLiked(bookId)) {
      return unlikeBook(bookId);
    } else {
      return likeBook(bookId);
    }
  };

  return {
    likedBooks,
    likedBookIds,
    loading,
    isLiked,
    likeBook,
    unlikeBook,
    toggleLike,
    refresh: fetchLikedBooks,
  };
};
