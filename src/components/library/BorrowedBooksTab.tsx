import { motion } from 'framer-motion';
import { Clock, BookOpen, Loader2, MessageCircle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Button } from '@/components/ui/button';

interface BorrowedBooksTabProps {
  borrowedBooks: any[];
  loading: boolean;
  onChat: (ownerId: string, bookId: string) => void;
}

export const BorrowedBooksTab = ({ borrowedBooks, loading, onChat }: BorrowedBooksTabProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (borrowedBooks.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="font-display text-xl font-medium text-foreground mb-2">아직 빌린 책이 없어요</h3>
        <p className="text-muted-foreground text-sm">
          Browse the shelf and find books to rent or buy!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {borrowedBooks.map((transaction, index) => {
        const book = transaction.book;
        if (!book) return null;

        const isPending = transaction.status === 'pending';
        const isActive = transaction.status === 'active';

        return (
          <motion.div
            key={transaction.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-card border border-border rounded-2xl p-4 flex gap-4"
          >
            {/* Cover */}
            <div className="w-16 h-24 rounded-lg overflow-hidden shrink-0">
              <img
                src={book.cover}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{book.title}</h3>
              <p className="text-sm text-muted-foreground truncate">{book.author}</p>
              
              {/* Status badge */}
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  isPending 
                    ? 'bg-accent/10 text-accent-foreground' 
                    : 'bg-primary/10 text-primary'
                }`}>
                  {isPending ? 'Pending Approval' : 'Active'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {transaction.type === 'rental' ? 'Rental' : 'Purchase'}
                </span>
              </div>

              {/* Rental period */}
              {isActive && transaction.start_date && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Started {format(new Date(transaction.start_date), 'MMM d')}
                    {transaction.end_date && ` · Due ${format(new Date(transaction.end_date), 'MMM d')}`}
                  </span>
                </div>
              )}

              {/* Owner info */}
              <p className="text-xs text-muted-foreground mt-2">
                From: {book.owner?.nickname || 'Unknown'}
              </p>

              {/* Chat button */}
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-2"
                onClick={() => onChat(book.owner_id, book.id)}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Message Owner
              </Button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
