import { BookMode } from '@/lib/bookMode';
// Unified Book type for the app - works with both DB and UI
export interface Book {
  id: string;
  title: string;
  author: string;
  cover: string;
  description: string | null;
  condition: 'S' | 'A' | 'B';
  mode: BookMode;
  price?: number | null;
  status: 'available' | 'rented' | 'sold';
  is_public: boolean;
  community_id: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  owner?: {
    nickname: string;
    avatar_url?: string | null;
  };
  community?: {
    name: string;
  } | null;
  spineColor: number;
}

/**
 * spine_color가 비어 있을 때 쓰는 폴백.
 * 랜덤이면 새로고침·기기마다 같은 책의 색이 달라진다("내 빨간 책"으로 기억할 수 없음).
 * 제목 해시로 결정론적으로 배정해 늘 같은 색이 나오게 한다.
 */
const spineFromTitle = (title: string) =>
  ((title || '').split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7) % 6) + 1;

// Transform DB row to Book type
export const transformDbBook = (row: any): Book => ({
  id: row.id,
  title: row.title,
  author: row.author,
  cover: row.cover_url || '', // Empty string signals to use DefaultBookCover component
  description: row.description,
  condition: row.condition as 'S' | 'A' | 'B',
  mode: row.mode as BookMode,
  price: row.price,
  status: row.status as 'available' | 'rented' | 'sold',
  is_public: row.is_public,
  community_id: row.community_id,
  owner_id: row.owner_id,
  created_at: row.created_at,
  updated_at: row.updated_at,
  owner: row.profile ? { nickname: row.profile.nickname, avatar_url: row.profile.avatar_url } : undefined,
  community: row.community ? { name: row.community.name } : null,
  spineColor: row.spine_color ?? spineFromTitle(row.title),
});
