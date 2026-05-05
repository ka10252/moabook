import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Transaction {
  id: string;
  book_id: string;
  owner_id: string;
  borrower_id: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  type: 'rent' | 'purchase';
  start_date: string | null;
  end_date: string | null;
  return_date: string | null;
  created_at: string;
  book?: {
    id: string;
    title: string;
    author: string;
    cover_url: string | null;
  };
  counterparty?: {
    id: string;
    nickname: string;
  };
  isMine: boolean; // true if current user is the owner
}

export const useTransactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          book:books(id, title, author, cover_url)
        `)
        .or(`owner_id.eq.${user.id},borrower_id.eq.${user.id}`)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Batch fetch all counterparty profiles in one query
      const counterpartyIds = (data || []).map(t =>
        t.owner_id === user.id ? t.borrower_id : t.owner_id
      );
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname')
        .in('id', counterpartyIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const transactionsWithDetails = (data || []).map(t => {
        const counterpartyId = t.owner_id === user.id ? t.borrower_id : t.owner_id;
        return {
          ...t,
          counterparty: profileMap.get(counterpartyId) || { id: counterpartyId, nickname: '알 수 없음' },
          isMine: t.owner_id === user.id,
        };
      });

      setTransactions(transactionsWithDetails);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const updateTransaction = async (transactionId: string, updates: {
    status?: 'pending' | 'active' | 'completed' | 'cancelled';
    type?: 'rent' | 'purchase';
    return_date?: string | null;
  }) => {
    const { error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', transactionId);

    if (error) throw error;

    // Update book status if needed
    const transaction = transactions.find(t => t.id === transactionId);
    if (transaction && updates.status === 'completed') {
      await supabase
        .from('books')
        .update({ status: 'available' })
        .eq('id', transaction.book_id);
    }

    await fetchTransactions();
  };

  const createTransaction = async (bookId: string, ownerId: string, borrowerId: string, type: 'rent' | 'purchase', returnDate?: string) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        book_id: bookId,
        owner_id: ownerId,
        borrower_id: borrowerId,
        type,
        status: 'active',
        start_date: new Date().toISOString(),
        return_date: returnDate || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Update book status
    await supabase
      .from('books')
      .update({ status: type === 'purchase' ? 'sold' : 'rented' })
      .eq('id', bookId);

    await fetchTransactions();
    return data;
  };

  // Get lent book IDs (books the current user owns but lent out)
  const getLentBookIds = useCallback((): Set<string> => {
    return new Set(
      transactions
        .filter(t => t.isMine && t.status === 'active' && t.type === 'rent')
        .map(t => t.book_id)
    );
  }, [transactions]);

  // Get lent books info with borrower nickname (books the current user owns but lent out)
  const getLentBooksInfo = useCallback((): Map<string, string> => {
    return new Map(
      transactions
        .filter(t => t.isMine && t.status === 'active' && t.type === 'rent')
        .map(t => [t.book_id, t.counterparty?.nickname || '대여자'])
    );
  }, [transactions]);

  // Get rented book IDs (books rented by current user from others)
  const getRentedBooksInfo = useCallback((): Map<string, string> => {
    return new Map(
      transactions
        .filter(t => !t.isMine && t.status === 'active' && t.type === 'rent')
        .map(t => [t.book_id, t.counterparty?.nickname || '알 수 없음'])
    );
  }, [transactions]);

  // Return dates for books I lent out (bookId → returnDate)
  const getLentReturnDates = useCallback((): Map<string, string | null> => {
    return new Map(
      transactions
        .filter(t => t.isMine && t.status === 'active' && t.type === 'rent')
        .map(t => [t.book_id, t.return_date])
    );
  }, [transactions]);

  // Return dates for books I borrowed (bookId → returnDate)
  const getBorrowedReturnDates = useCallback((): Map<string, string | null> => {
    return new Map(
      transactions
        .filter(t => !t.isMine && t.status === 'active' && t.type === 'rent')
        .map(t => [t.book_id, t.return_date])
    );
  }, [transactions]);

  return {
    transactions,
    loading,
    refresh: fetchTransactions,
    updateTransaction,
    createTransaction,
    getLentBookIds,
    getLentBooksInfo,
    getRentedBooksInfo,
    getLentReturnDates,
    getBorrowedReturnDates,
  };
};

export const useTransactionHistory = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setHistory([]); setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select(`*, book:books(id, title, author, cover_url)`)
          .or(`owner_id.eq.${user.id},borrower_id.eq.${user.id}`)
          .in('status', ['completed', 'cancelled'])
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        const counterpartyIds = (data || []).map(t =>
          t.owner_id === user.id ? t.borrower_id : t.owner_id
        );
        const { data: profiles } = await supabase
          .from('profiles').select('id, nickname').in('id', counterpartyIds);
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        setHistory(
          (data || []).map(t => {
            const cpId = t.owner_id === user.id ? t.borrower_id : t.owner_id;
            return {
              ...t,
              counterparty: profileMap.get(cpId) || { id: cpId, nickname: '알 수 없음' },
              isMine: t.owner_id === user.id,
            };
          })
        );
      } catch (e) {
        console.error('Failed to fetch history:', e);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [user?.id]);

  return { history, loading };
};
