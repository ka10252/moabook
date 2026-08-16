import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Book, transformDbBook } from '@/types/book';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelIdRef = useRef(Math.random().toString(36).slice(2, 10));

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('books')
        .select(`
          *,
          profile:profiles!books_owner_id_fkey(nickname, avatar_url, district, mrt_station),
          community:communities(name)
        `)
        .neq('status', 'sold') // Exclude sold books from bookshelf
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

  // Realtime subscription — refresh on any books change
  //
  // 주의할 점 두 가지:
  //  1) 채널 토픽이 고정 문자열이면 useBooks를 쓰는 화면(책장/내 서재)이 동시에 뜰 때 충돌한다.
  //  2) books 테이블의 모든 변경이 전체 목록 재조회를 부른다. 유저가 늘면 한 명이 책을 올릴 때마다
  //     접속자 전원이 조인 걸린 풀 쿼리를 다시 던진다. 짧은 시간의 연속 이벤트는 한 번으로 합친다.
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    channelRef.current = supabase
      .channel(`books-changes:${channelIdRef.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetchBooks(), 300);
      })
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [fetchBooks]);

  // 차단/해제 시 즉시 재조회 — 차단한 사람 책은 RLS로 걸러져 목록에서 바로 사라진다.
  useEffect(() => {
    const onBlocked = () => fetchBooks();
    window.addEventListener('moa:blocked-changed', onBlocked);
    return () => window.removeEventListener('moa:blocked-changed', onBlocked);
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
        allow_rent: updates.allowRent,
        allow_sell: updates.allowSell,
        allow_give: updates.allowGive,
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
