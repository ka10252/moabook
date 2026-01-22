// Dummy transaction data to demonstrate lent/borrowed status
// These would normally come from the transactions table

export interface DummyTransaction {
  id: string;
  book_id: string;
  owner_id: string;
  borrower_id: string;
  borrower_nickname: string;
  owner_nickname: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  type: 'rent' | 'purchase';
}

// Dummy current user ID for demonstration
export const DEMO_USER_ID = 'demo-user-123';

// Transactions where the demo user has LENT their books to others
export const dummyLentTransactions: DummyTransaction[] = [
  {
    id: 'trans-1',
    book_id: 'dummy-1', // 82년생 김지영
    owner_id: DEMO_USER_ID,
    borrower_id: 'user-456',
    borrower_nickname: '책벌레민수',
    owner_nickname: 'You',
    status: 'active',
    type: 'rent',
  },
  {
    id: 'trans-2',
    book_id: 'dummy-4', // 달러구트 꿈 백화점
    owner_id: DEMO_USER_ID,
    borrower_id: 'user-789',
    borrower_nickname: '독서왕지현',
    owner_nickname: 'You',
    status: 'active',
    type: 'rent',
  },
];

// Transactions where the demo user has BORROWED books from others
export const dummyBorrowedTransactions: DummyTransaction[] = [
  {
    id: 'trans-3',
    book_id: 'dummy-5', // 파친코
    owner_id: 'dummy-owner',
    borrower_id: DEMO_USER_ID,
    borrower_nickname: 'You',
    owner_nickname: '문학소녀',
    status: 'active',
    type: 'rent',
  },
  {
    id: 'trans-4',
    book_id: 'dummy-7', // 채식주의자
    owner_id: 'dummy-owner',
    borrower_id: DEMO_USER_ID,
    borrower_nickname: 'You',
    owner_nickname: '한강팬',
    status: 'active',
    type: 'rent',
  },
];

// Get lent book IDs (books the current user owns but lent out)
export const getLentBookIds = (userId: string): Set<string> => {
  return new Set(
    dummyLentTransactions
      .filter(t => t.owner_id === userId && t.status === 'active')
      .map(t => t.book_id)
  );
};

// Get borrowed books info (books the current user borrowed)
export const getBorrowedBooksInfo = (userId: string): Map<string, string> => {
  return new Map(
    dummyBorrowedTransactions
      .filter(t => t.borrower_id === userId && t.status === 'active')
      .map(t => [t.book_id, t.owner_nickname])
  );
};
