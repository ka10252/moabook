import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WoodenShelf } from './WoodenShelf';
import { BookSpine } from './BookSpine';
import { BookCover } from './BookCover';
import { BookDetail } from './BookDetail';
import { ViewToggle, ViewMode } from './ViewToggle';
import { Book, sampleBooks } from '@/data/books';
import { Filter } from 'lucide-react';

export const Bookshelf = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('spine');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [previewBook, setPreviewBook] = useState<string | null>(null);

  // Split books into shelf rows (4 books per shelf for spine view)
  const booksPerShelf = viewMode === 'spine' ? 4 : 4;
  const shelves: Book[][] = [];
  for (let i = 0; i < sampleBooks.length; i += booksPerShelf) {
    shelves.push(sampleBooks.slice(i, i + booksPerShelf));
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <h1 className="text-xl font-bold text-foreground">Everybody's Shelf</h1>
        <div className="flex items-center gap-3">
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          <button className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-primary transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Bookshelf Container */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
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
              {sampleBooks.map((book, index) => (
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
      </div>

      {/* Book Detail Modal */}
      <BookDetail book={selectedBook} onClose={() => setSelectedBook(null)} />
    </div>
  );
};
