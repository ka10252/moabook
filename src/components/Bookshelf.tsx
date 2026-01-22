import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WoodenShelf } from './WoodenShelf';
import { BookSpine } from './BookSpine';
import { BookCover } from './BookCover';
import { BookDetailWithActions } from './BookDetailWithActions';
import { EditBookModal } from './library/EditBookModal';
import { ViewToggle, ViewMode } from './ViewToggle';
import { Book } from '@/types/book';
import { useBooks, useBorrowedBooks } from '@/hooks/useBooks';
import { useCommunities } from '@/hooks/useCommunities';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, Loader2, BookOpen } from 'lucide-react';
import { dummyKoreanBooks } from '@/data/dummyBooks';
import { getLentBookIds, getBorrowedBooksInfo, DEMO_USER_ID } from '@/data/dummyTransactions';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface BookshelfProps {
  onOpenChat: (userId: string, bookId: string) => void;
}

type FilterType = 'everybody' | 'mine' | string; // string for community IDs

export const Bookshelf = ({ onOpenChat }: BookshelfProps) => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('spine');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [previewBook, setPreviewBook] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('everybody');

  const { myCommunities } = useCommunities();
  const { books: allBooks, loading, deleteBook, updateBook, refresh } = useBooks({});
  const { borrowedBooks } = useBorrowedBooks();

  // For demo purposes, use dummy transactions if user is logged in
  // In production, this would come from real transactions
  const lentBookIds = useMemo(() => {
    if (user) {
      // Check for real lent transactions here
      // For demo, use dummy data
      return getLentBookIds(DEMO_USER_ID);
    }
    return new Set<string>();
  }, [user]);

  // Get borrowed books info (books I borrowed from others)
  const borrowedBooksInfo = useMemo(() => {
    // First check real borrowed books
    const realBorrowed = new Map(
      borrowedBooks
        .filter(t => t.book)
        .map(t => [t.book.id, t.book.owner?.nickname || 'Someone'])
    );
    
    // For demo, merge with dummy data
    if (user) {
      const dummyBorrowed = getBorrowedBooksInfo(DEMO_USER_ID);
      dummyBorrowed.forEach((nickname, bookId) => {
        if (!realBorrowed.has(bookId)) {
          realBorrowed.set(bookId, nickname);
        }
      });
    }
    
    return realBorrowed;
  }, [borrowedBooks, user]);

  // Filter books based on active filter
  const filteredBooks = useMemo(() => {
    let books = allBooks.length > 0 ? allBooks : dummyKoreanBooks;
    
    if (activeFilter === 'mine') {
      return books.filter(book => book.owner_id === user?.id);
    } else if (activeFilter !== 'everybody') {
      // Filter by community ID
      return books.filter(book => book.community_id === activeFilter);
    }
    
    return books;
  }, [allBooks, activeFilter, user?.id]);

  // Organize books: user's books first in "everybody's" or community views
  const organizedBooks = useMemo(() => {
    if (!user || activeFilter === 'mine') {
      return filteredBooks;
    }
    
    const myBooks = filteredBooks.filter(book => book.owner_id === user.id);
    const otherBooks = filteredBooks.filter(book => book.owner_id !== user.id);
    
    return [...myBooks, ...otherBooks];
  }, [filteredBooks, user, activeFilter]);

  // Split books into shelf rows (4 books per shelf for spine view)
  const booksPerShelf = 4;
  const shelves: Book[][] = [];
  for (let i = 0; i < organizedBooks.length; i += booksPerShelf) {
    shelves.push(organizedBooks.slice(i, i + booksPerShelf));
  }

  // Always show at least 3 empty shelves
  const minShelves = 3;
  const emptyShelvesNeeded = Math.max(0, minShelves - shelves.length);

  const getFilterLabel = () => {
    if (activeFilter === 'everybody') return "Everybody's";
    if (activeFilter === 'mine') return 'My Books';
    const community = myCommunities.find(c => c.id === activeFilter);
    return community?.name || 'Community';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground">Bookshelf</h1>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors">
              {getFilterLabel()}
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover border border-border shadow-lg z-50">
              <DropdownMenuItem 
                onClick={() => setActiveFilter('everybody')}
                className={activeFilter === 'everybody' ? 'bg-accent' : ''}
              >
                Everybody's
              </DropdownMenuItem>
              {user && (
                <DropdownMenuItem 
                  onClick={() => setActiveFilter('mine')}
                  className={activeFilter === 'mine' ? 'bg-accent' : ''}
                >
                  My Books
                </DropdownMenuItem>
              )}
              {myCommunities.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    My Communities
                  </div>
                  {myCommunities.map(community => (
                    <DropdownMenuItem 
                      key={community.id}
                      onClick={() => setActiveFilter(community.id)}
                      className={activeFilter === community.id ? 'bg-accent' : ''}
                    >
                      {community.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Bookshelf Container */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === 'spine' ? (
              <motion.div
                key="spine-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Wooden bookcase frame */}
                <div className="wood-texture rounded-lg p-4 shadow-shelf">
                  <div className="space-y-2">
                    {/* Shelves with books */}
                    {shelves.map((shelfBooks, shelfIndex) => (
                      <WoodenShelf key={shelfIndex}>
                        <div className="flex items-end gap-1 h-[140px]">
                          {shelfBooks.map((book) => (
                            <BookSpine
                              key={book.id}
                              book={book}
                              onClick={() => setSelectedBook(book)}
                              isSelected={previewBook === book.id}
                              isLent={lentBookIds.has(book.id)}
                              isBorrowed={borrowedBooksInfo.has(book.id)}
                              lenderNickname={borrowedBooksInfo.get(book.id)}
                            />
                          ))}
                        </div>
                      </WoodenShelf>
                    ))}
                    
                    {/* Empty shelves to maintain structure */}
                    {Array.from({ length: emptyShelvesNeeded }).map((_, i) => (
                      <WoodenShelf key={`empty-${i}`} isEmpty>
                        <div className="h-[140px]" />
                      </WoodenShelf>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="cover-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {organizedBooks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <BookOpen className="w-16 h-16 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No books yet</h3>
                    <p className="text-muted-foreground text-sm max-w-xs">
                      {activeFilter === 'mine' 
                        ? 'You haven\'t uploaded any books yet.'
                        : 'The shelf is empty. Upload a book to get started!'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {organizedBooks.map((book, index) => (
                      <motion.div
                        key={book.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <BookCover
                          book={book}
                          onClick={() => setSelectedBook(book)}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Book Detail Modal with Edit/Delete */}
      <BookDetailWithActions 
        book={selectedBook} 
        onClose={() => setSelectedBook(null)} 
        onChat={onOpenChat}
        onEdit={(book) => {
          setSelectedBook(null);
          setEditingBook(book);
        }}
        onDelete={async (bookId) => {
          const { error } = await deleteBook(bookId);
          if (error) {
            toast.error('Failed to delete book');
          } else {
            toast.success('Book removed from shelf');
          }
        }}
        currentUserId={user?.id}
      />

      {/* Edit Modal */}
      <EditBookModal
        book={editingBook}
        onClose={() => setEditingBook(null)}
        onSave={async (bookId, updates) => {
          const result = await updateBook(bookId, updates);
          return result;
        }}
      />
    </div>
  );
};
