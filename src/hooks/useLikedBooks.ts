import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Book, transformDbBook } from '@/types/book';

// 여러 곳(서가 FAB 배지 · 관심도서 팝업 · 책 상세 하트)에서 동시에 쓰인다.
// 인스턴스마다 상태를 따로 두면, 상세에서 하트를 눌러도 팝업/배지가 새로고침 전엔 안 바뀐다.
// → 모듈 공유 스토어 하나로 모두가 같은 상태를 본다.

interface LikedBookRecord {
  id: string;
  user_id: string;
  book_id: string;
  created_at: string;
  book?: Book;
}

// ---- 공유 스토어 ----
let likedBooks: LikedBookRecord[] = [];
let likedBookIds = new Set<string>();
let loading = true;
let storeUserId: string | null = null;
let fetching = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const getLiked = () => likedBooks;
const getIds = () => likedBookIds;
const getLoading = () => loading;

async function fetchLikedBooks() {
  if (!storeUserId) { likedBooks = []; likedBookIds = new Set(); loading = false; emit(); return; }
  fetching = true; loading = true; emit();
  try {
    const { data: likedData, error: likedError } = await supabase
      .from('liked_books' as never)
      .select('id, user_id, book_id, created_at')
      .eq('user_id', storeUserId)
      .order('created_at', { ascending: false });
    if (likedError) throw likedError;

    const rows = (likedData || []) as unknown as LikedBookRecord[];
    if (rows.length === 0) {
      likedBooks = []; likedBookIds = new Set();
      return;
    }
    const bookIds = rows.map((r) => r.book_id);
    const { data: booksData, error: booksError } = await supabase
      .from('books')
      .select(`
        id, title, author, cover_url, condition, mode, price, description,
        is_public, community_id, owner_id, status, created_at, updated_at,
        owner:profiles(id, nickname), community:communities(id, name)
      `)
      .in('id', bookIds);
    if (booksError) throw booksError;

    const booksMap = new Map<string, Book>();
    (booksData || []).forEach((b: unknown) => {
      const book = transformDbBook(b as never);
      booksMap.set(book.id, book);
    });
    likedBooks = rows.map((r) => ({ ...r, book: booksMap.get(r.book_id) }));
    likedBookIds = new Set(rows.map((r) => r.book_id));
  } catch (err) {
    console.error('Failed to fetch liked books:', err);
  } finally {
    fetching = false; loading = false; emit();
  }
}

function setupFor(userId: string | null) {
  if (userId === storeUserId) return;
  storeUserId = userId;
  if (!userId) { likedBooks = []; likedBookIds = new Set(); loading = false; emit(); return; }
  fetchLikedBooks();
}

async function likeBook(bookId: string) {
  if (!storeUserId) return { error: new Error('로그인이 필요합니다') };
  const { error } = await supabase.from('liked_books' as never).insert({ user_id: storeUserId, book_id: bookId } as never);
  if (!error) {
    likedBookIds = new Set([...likedBookIds, bookId]);
    emit();
    await fetchLikedBooks(); // 목록(책 정보 포함)까지 최신화 → 팝업·배지 즉시 반영
  }
  return { error };
}

async function unlikeBook(bookId: string) {
  if (!storeUserId) return { error: new Error('로그인이 필요합니다') };
  const { error } = await supabase.from('liked_books' as never).delete().eq('user_id', storeUserId).eq('book_id', bookId);
  if (!error) {
    const next = new Set(likedBookIds); next.delete(bookId); likedBookIds = next;
    likedBooks = likedBooks.filter((r) => r.book_id !== bookId);
    emit();
  }
  return { error };
}

async function toggleLike(bookId: string) {
  return likedBookIds.has(bookId) ? unlikeBook(bookId) : likeBook(bookId);
}

export const useLikedBooks = () => {
  const { user } = useAuth();
  useEffect(() => { setupFor(user?.id ?? null); }, [user?.id]);

  const books = useSyncExternalStore(subscribe, getLiked, getLiked);
  const ids = useSyncExternalStore(subscribe, getIds, getIds);
  const isLoading = useSyncExternalStore(subscribe, getLoading, getLoading);

  return {
    likedBooks: books,
    likedBookIds: ids,
    loading: isLoading,
    isLiked: (bookId: string) => ids.has(bookId),
    likeBook,
    unlikeBook,
    toggleLike,
    refresh: fetchLikedBooks,
  };
};
