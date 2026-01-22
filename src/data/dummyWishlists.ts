// Dummy wishlist data for testing message functionality

export interface DummyWishlist {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  notes: string | null;
  is_fulfilled: boolean;
  created_at: string;
  profile: {
    nickname: string;
  };
}

export const dummyWishlists: DummyWishlist[] = [
  {
    id: 'wish-1',
    // Must be a valid UUID because chat/conversations expect UUID participant ids
    user_id: '11111111-1111-1111-1111-111111111111',
    title: '작별인사',
    author: '김영하',
    notes: '김영하 작가님의 최신작을 찾고 있어요. 어디서든 구하기 힘들더라고요.',
    is_fulfilled: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    profile: { nickname: '문학소녀' },
  },
  {
    id: 'wish-2',
    user_id: '22222222-2222-2222-2222-222222222222',
    title: '아몬드',
    author: '손원평',
    notes: '감정을 못 느끼는 소년 이야기인데 꼭 읽어보고 싶습니다!',
    is_fulfilled: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    profile: { nickname: '책벌레민수' },
  },
  {
    id: 'wish-3',
    user_id: '33333333-3333-3333-3333-333333333333',
    title: '불편한 편의점',
    author: '김호연',
    notes: '베스트셀러라고 해서 빌려보고 싶어요.',
    is_fulfilled: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    profile: { nickname: '독서왕지현' },
  },
  {
    id: 'wish-4',
    user_id: '44444444-4444-4444-4444-444444444444',
    title: '세이노의 가르침',
    author: '세이노',
    notes: null,
    is_fulfilled: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
    profile: { nickname: '한강팬' },
  },
  {
    id: 'wish-5',
    user_id: '55555555-5555-5555-5555-555555555555',
    title: '역행자',
    author: '자청',
    notes: '자기계발서 중에 제일 좋다고 해서 찾고 있습니다.',
    is_fulfilled: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(), // 4 days ago
    profile: { nickname: '북마크킹' },
  },
];
