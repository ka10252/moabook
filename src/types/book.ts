import type { BookCondition } from '@/lib/bookCondition';
import { BookMode } from '@/lib/bookMode';
// Unified Book type for the app - works with both DB and UI
export interface Book {
  id: string;
  title: string;
  author: string;
  cover: string;
  description: string | null;
  condition: BookCondition;
  mode: BookMode;               // 대표 모드(호환용). 실제 허용 방식은 아래 3개.
  allowRent: boolean;
  allowSell: boolean;
  allowGive: boolean;
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
    /** 책 위치의 근거 — 주인이 고른 가까운 MRT역. 지도뷰가 이걸로 묶는다 */
    mrtStation?: string | null;
    /** 지역 필터용 planning area. 역을 고르면 함께 채워진다 */
    district?: string | null;
  };
  community?: {
    name: string;
  } | null;
  /** 장르 — src/lib/genre.ts 의 GENRES 값. 비어 있으면 '기타'로 본다 */
  genre?: string | null;
  /** 표지에서 뽑은 색상 0~359. 책등 색의 색상이 여기서 온다. null=추출 실패 → 기본 팔레트 */
  coverHue?: number | null;
  /** 관리자가 숨긴 시각. 값이 있으면 남에게 안 보이고 주인에게만 보인다 */
  hiddenAt?: string | null;
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
  condition: row.condition as BookCondition,
  mode: row.mode as BookMode,
  // 새 컬럼(allow_*)이 있으면 그걸, 없으면 대표 mode에서 유도(마이그 전 호환).
  allowRent: row.allow_rent ?? (row.mode === 'rent'),
  allowSell: row.allow_sell ?? (row.mode === 'sell'),
  allowGive: row.allow_give ?? (row.mode === 'give'),
  price: row.price,
  status: row.status as 'available' | 'rented' | 'sold',
  is_public: row.is_public,
  community_id: row.community_id,
  owner_id: row.owner_id,
  created_at: row.created_at,
  updated_at: row.updated_at,
  // district를 여기서 빠뜨리면 서가의 지역 필터가 조용히 전부 걸러낸다(예전에 그랬다).
  owner: row.profile
    ? {
        nickname: row.profile.nickname,
        avatar_url: row.profile.avatar_url,
        mrtStation: row.profile.mrt_station ?? null,
        district: row.profile.district ?? null,
      }
    : undefined,
  community: row.community ? { name: row.community.name } : null,
  genre: row.genre ?? null,
  coverHue: row.cover_hue ?? null,
  hiddenAt: row.hidden_at ?? null,
  spineColor: row.spine_color ?? spineFromTitle(row.title),
});
