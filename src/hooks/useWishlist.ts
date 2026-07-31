import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface WishlistItem {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  notes: string | null;
  is_fulfilled: boolean;
  created_at: string;
  profile?: {
    nickname: string;
  };
}

export const useWishlist = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [myItems, setMyItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWishlists = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all wishlists with profile info
      const { data, error: fetchError } = await supabase
        .from('wishlists')
        .select(`
          *,
          profile:profiles!wishlists_user_id_fkey(nickname)
        `)
        .eq('is_fulfilled', false)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const realItems: WishlistItem[] = (data || []).map(item => ({
        ...item,
        profile: item.profile as { nickname: string } | undefined
      }));

      setItems(realItems);
      setMyItems(realItems.filter(item => item.user_id === user?.id));
    } catch (err) {
      setItems([]);
      setMyItems([]);
      setError(err instanceof Error ? err.message : 'Failed to load wishlists');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchWishlists();
  }, [fetchWishlists]);

  const addItem = async (title: string, author: string | null, notes: string | null) => {
    if (!user) return { error: new Error('Must be logged in') };

    const { error } = await supabase.from('wishlists').insert({
      user_id: user.id,
      title: title.trim(),
      author: author?.trim() || null,
      notes: notes?.trim() || null,
    });

    if (!error) {
      await fetchWishlists();
    }

    return { error };
  };

  const updateNotes = async (id: string, notes: string) => {
    const { error } = await supabase
      .from('wishlists')
      .update({ notes: notes.trim() || null })
      .eq('id', id);

    if (!error) {
      await fetchWishlists();
    }

    return { error };
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchWishlists();
    }

    return { error };
  };

  const markFulfilled = async (id: string) => {
    const { error } = await supabase
      .from('wishlists')
      .update({ is_fulfilled: true })
      .eq('id', id);

    if (!error) {
      await fetchWishlists();
    }

    return { error };
  };

  return {
    items,
    myItems,
    loading,
    error,
    addItem,
    updateNotes,
    removeItem,
    markFulfilled,
    refresh: fetchWishlists,
  };
};
