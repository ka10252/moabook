export interface DummyCommunity {
  id: string;
  name: string;
  description: string;
  member_count: number;
  cover_url: string | null;
}

export const dummyCommunities: DummyCommunity[] = [
  {
    id: 'dummy-1',
    name: 'SNU in Paris 2025',
    description: 'Seoul National University exchange students in Paris',
    member_count: 23,
    cover_url: null,
  },
  {
    id: 'dummy-2',
    name: 'Yonsei Global House',
    description: 'Yonsei University international dorm book club',
    member_count: 45,
    cover_url: null,
  },
  {
    id: 'dummy-3',
    name: 'KAIST Book Exchange',
    description: 'Share and exchange textbooks at KAIST',
    member_count: 67,
    cover_url: null,
  },
  {
    id: 'dummy-4',
    name: 'Korea Uni Lyon',
    description: 'Korea University students studying in Lyon, France',
    member_count: 18,
    cover_url: null,
  },
  {
    id: 'dummy-5',
    name: 'Ewha Berlin Circle',
    description: 'Ewha Womans University exchange program in Berlin',
    member_count: 31,
    cover_url: null,
  },
  {
    id: 'dummy-6',
    name: 'Hanyang Tokyo Exchange',
    description: 'Hanyang University students in Tokyo',
    member_count: 28,
    cover_url: null,
  },
  {
    id: 'dummy-7',
    name: 'Sogang Barcelona',
    description: 'Sogang University students in Barcelona',
    member_count: 15,
    cover_url: null,
  },
  {
    id: 'dummy-8',
    name: 'POSTECH Singapore',
    description: 'POSTECH exchange students in Singapore',
    member_count: 22,
    cover_url: null,
  },
];
