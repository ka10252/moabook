import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBooks, useBorrowedBooks } from '@/hooks/useBooks';
import { MyBooksTab } from './MyBooksTab';
import { BorrowedBooksTab } from './BorrowedBooksTab';
import { EditBookModal } from './EditBookModal';
import { Book } from '@/types/book';

interface LibraryPageProps {
  onOpenChat: (userId: string, bookId: string) => void;
}

export const LibraryPage = ({ onOpenChat }: LibraryPageProps) => {
  const { books: myBooks, loading: loadingMyBooks, deleteBook, updateBook, refresh } = useBooks({ onlyMine: true });
  const { borrowedBooks, loading: loadingBorrowed } = useBorrowedBooks();
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  const handleSaveBook = async (bookId: string, updates: Partial<Book>) => {
    const result = await updateBook(bookId, updates);
    return result;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-5 pt-5 pb-3 bg-background/85 backdrop-blur-md sticky top-0 z-30 border-b border-border/40">
        <p className="eyebrow">Personal Collection</p>
        <h1 className="font-display text-[26px] font-medium leading-none tracking-tight text-foreground mt-1">나의 도서관</h1>
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
              onEdit={setEditingBook}
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

      {/* Edit Modal */}
      <EditBookModal
        book={editingBook}
        onClose={() => setEditingBook(null)}
        onSave={handleSaveBook}
      />
    </div>
  );
};
