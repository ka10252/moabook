import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBooks, useBorrowedBooks } from '@/hooks/useBooks';
import { MyBooksTab } from './MyBooksTab';
import { BorrowedBooksTab } from './BorrowedBooksTab';
import { Book } from '@/types/book';

interface LibraryPageProps {
  onOpenChat: (userId: string, bookId: string) => void;
}

export const LibraryPage = ({ onOpenChat }: LibraryPageProps) => {
  const { books: myBooks, loading: loadingMyBooks, deleteBook, refresh } = useBooks({ onlyMine: true });
  const { borrowedBooks, loading: loadingBorrowed } = useBorrowedBooks();

  const handleEdit = (book: Book) => {
    // TODO: Open edit modal
    console.log('Edit book:', book.id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 py-4 bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <h1 className="text-xl font-bold text-foreground">My Library</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <Tabs defaultValue="my-books" className="w-full">
          <TabsList className="w-full grid grid-cols-2 bg-muted">
            <TabsTrigger value="my-books">
              My Books {myBooks.length > 0 && `(${myBooks.length})`}
            </TabsTrigger>
            <TabsTrigger value="borrowed">
              Borrowed {borrowedBooks.length > 0 && `(${borrowedBooks.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-books" className="mt-4">
            <MyBooksTab
              books={myBooks}
              loading={loadingMyBooks}
              onDelete={deleteBook}
              onEdit={handleEdit}
            />
          </TabsContent>

          <TabsContent value="borrowed" className="mt-4">
            <BorrowedBooksTab
              borrowedBooks={borrowedBooks}
              loading={loadingBorrowed}
              onChat={onOpenChat}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
