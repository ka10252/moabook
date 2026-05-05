// Unified Book type for the app - works with both DB and UI
export interface Book {
  id: string;
  title: string;
  author: string;
  cover: string;
  description: string | null;
  condition: 'S' | 'A' | 'B';
  mode: 'rent' | 'sell';
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

// Transform DB row to Book type
export const transformDbBook = (row: any): Book => ({
  id: row.id,
  title: row.title,
  author: row.author,
  cover: row.cover_url || '', // Empty string signals to use DefaultBookCover component
  description: row.description,
  condition: row.condition as 'S' | 'A' | 'B',
  mode: row.mode as 'rent' | 'sell',
  price: row.price,
  status: row.status as 'available' | 'rented' | 'sold',
  is_public: row.is_public,
  community_id: row.community_id,
  owner_id: row.owner_id,
  created_at: row.created_at,
  updated_at: row.updated_at,
  owner: row.profile ? { nickname: row.profile.nickname, avatar_url: row.profile.avatar_url } : undefined,
  community: row.community ? { name: row.community.name } : null,
  spineColor: row.spine_color ?? (Math.floor(Math.random() * 6) + 1),
});
