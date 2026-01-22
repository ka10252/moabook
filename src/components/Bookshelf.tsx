import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WoodenShelf } from './WoodenShelf';
import { BookSpine } from './BookSpine';
import { BookCover } from './BookCover';
import { BookDetail } from './BookDetail';
import { ViewToggle, ViewMode } from './ViewToggle';
import { Book } from '@/types/book';
import { useBooks } from '@/hooks/useBooks';
import { useCommunities } from '@/hooks/useCommunities';
import { useAuth } from '@/hooks/useAuth';
import { Filter, Loader2, BookOpen, X } from 'lucide-react';
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

export const Bookshelf = ({ onOpenChat }: BookshelfProps) => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('spine');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [previewBook, setPreviewBook] = useState<string | null>(null);
  const [communityFilter, setCommunityFilter] = useState<string | null>(null);

  const { myCommunities } = useCommunities();
  const { books, loading } = useBooks({ 
    communityId: communityFilter,
  });

  // Split books into shelf rows (4 books per shelf for spine view)
  const booksPerShelf = 4;
  const shelves: Book[][] = [];
  for (let i = 0; i < books.length; i += booksPerShelf) {
    shelves.push(books.slice(i, i + booksPerShelf));
  }

  const selectedCommunity = myCommunities.find(c => c.id === communityFilter);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground">
            {communityFilter ? selectedCommunity?.name : "Everybody's Shelf"}
          </h1>
          {communityFilter && (
            <button 
              onClick={() => setCommunityFilter(null)}
              className="text-xs text-primary flex items-center gap-1 mt-0.5"
            >
              <X className="w-3 h-3" />
              Clear filter
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          
          <DropdownMenu>
            <DropdownMenuTrigger className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-primary transition-colors">
              <Filter className="w-5 h-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setCommunityFilter(null)}>
                All Books
              </DropdownMenuItem>
              {myCommunities.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    My Communities
                  </div>
                  {myCommunities.map(community => (
                    <DropdownMenuItem 
                      key={community.id}
                      onClick={() => setCommunityFilter(community.id)}
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
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <BookOpen className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No books yet</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              {communityFilter 
                ? 'No books in this community yet. Be the first to upload!'
                : 'The shelf is empty. Upload a book to get started!'}
            </p>
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
                className="space-y-6"
              >
                {/* Wooden bookcase frame */}
                <div className="wood-texture rounded-lg p-4 shadow-shelf">
                  <div className="space-y-2">
                    {shelves.map((shelfBooks, shelfIndex) => (
                      <WoodenShelf key={shelfIndex}>
                        <div className="flex items-end gap-1 h-[140px]">
                          {shelfBooks.map((book) => (
                            <BookSpine
                              key={book.id}
                              book={book}
                              onClick={() => setSelectedBook(book)}
                              isSelected={previewBook === book.id}
                            />
                          ))}
                        </div>
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
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
              >
                {books.map((book, index) => (
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
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Book Detail Modal */}
      <BookDetail 
        book={selectedBook} 
        onClose={() => setSelectedBook(null)} 
        onChat={onOpenChat}
        currentUserId={user?.id}
      />
    </div>
  );
};
