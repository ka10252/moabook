import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface BookReview {
  id: string;
  book_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  author?: { nickname: string; avatar_url: string | null } | null;
}

/**
 * 책 별점 리뷰.
 *
 * 한 사람이 한 책에 하나만 남긴다(DB unique). 여러 번 빌려도 리뷰는 갱신이지 추가가 아니다.
 * 그래서 저장은 언제나 upsert다 — "이미 썼는지"를 화면이 따로 판단하지 않아도 된다.
 */
export function useBookReviews(bookId?: string | null) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<BookReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const COLS = 'id, book_id, user_id, rating, comment, created_at, updated_at';

  const fetch = useCallback(async () => {
    if (!bookId) { setReviews([]); return; }
    setLoading(true);

    // 작성자 프로필을 같이 받는다(한 번의 왕복).
    const withAuthor = await supabase
      .from('book_reviews' as never)
      .select(`${COLS}, author:profiles!book_reviews_user_id_fkey(nickname, avatar_url)`)
      .eq('book_id', bookId)
      .order('updated_at', { ascending: false });

    if (!withAuthor.error) {
      setReviews((withAuthor.data ?? []) as unknown as BookReview[]);
      setLoading(false);
      return;
    }

    // FK가 profiles를 안 가리키면 조인이 통째로 400이 난다(PGRST200).
    // 그때 리뷰를 아예 못 보여주는 것보다 닉네임 없이라도 보여주는 게 낫다.
    const plain = await supabase
      .from('book_reviews' as never)
      .select(COLS)
      .eq('book_id', bookId)
      .order('updated_at', { ascending: false });
    if (!plain.error) setReviews((plain.data ?? []) as unknown as BookReview[]);
    setLoading(false);
  }, [bookId]);

  useEffect(() => { fetch(); }, [fetch]);

  const myReview = user ? reviews.find((r) => r.user_id === user.id) ?? null : null;
  const count = reviews.length;
  const average = count > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
    : null;

  const save = useCallback(async (rating: number, comment: string) => {
    if (!user || !bookId) return { error: new Error('로그인이 필요해요') };
    setSaving(true);
    const { error } = await supabase
      .from('book_reviews' as never)
      .upsert(
        { book_id: bookId, user_id: user.id, rating, comment: comment.trim() || null } as never,
        { onConflict: 'book_id,user_id' }
      );
    setSaving(false);
    if (!error) await fetch();
    return { error: error ? new Error(error.message) : null };
  }, [user, bookId, fetch]);

  const remove = useCallback(async () => {
    if (!user || !bookId) return { error: new Error('로그인이 필요해요') };
    setSaving(true);
    const { error } = await supabase
      .from('book_reviews' as never)
      .delete()
      .eq('book_id', bookId)
      .eq('user_id', user.id);
    setSaving(false);
    if (!error) await fetch();
    return { error: error ? new Error(error.message) : null };
  }, [user, bookId, fetch]);

  return { reviews, myReview, average, count, loading, saving, save, remove, refresh: fetch };
}
