import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, Heart, Share2 } from 'lucide-react';
import { Book } from '@/types/book';

interface BookDetailProps {
  book: Book | null;
  onClose: () => void;
  onChat: (ownerId: string, bookId: string) => void;
  currentUserId?: string;
}

export const BookDetail = ({ book, onClose, onChat, currentUserId }: BookDetailProps) => {
  if (!book) return null;

  const isOwner = currentUserId === book.owner_id;

  return (
    <AnimatePresence>
      {book && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            className="fixed inset-x-4 top-4 md:inset-x-auto md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 z-50"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="glass-card h-full max-h-[85vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="relative h-64 flex-shrink-0">
                <img
                  src={book.cover}
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full bg-card/80 backdrop-blur-sm text-foreground hover:bg-card transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                {/* Badges */}
                <div className="absolute top-4 left-4 flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    book.condition === 'S' 
                      ? 'bg-accent text-accent-foreground' 
                      : book.condition === 'A'
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {book.condition === 'S' ? 'Like New' : book.condition === 'A' ? 'Good' : 'Used'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    book.mode === 'rent' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-accent text-accent-foreground'
                  }`}>
                    {book.mode === 'rent' ? 'For Rent' : `$${book.price}`}
                  </span>
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <h2 className="text-2xl font-bold text-foreground mb-1">{book.title}</h2>
                <p className="text-muted-foreground mb-4">by {book.author}</p>
                
                {book.description && (
                  <p className="text-foreground/80 leading-relaxed mb-6">
                    {book.description}
                  </p>
                )}
                
                {/* Owner info */}
                <div className="bg-muted/50 rounded-2xl p-4 mb-6">
                  <p className="text-sm text-muted-foreground mb-1">Listed by</p>
                  <p className="font-semibold text-foreground">{book.owner?.nickname || 'Unknown'}</p>
                  {book.community && (
                    <p className="text-sm text-primary">{book.community.name}</p>
                  )}
                  {book.is_public && !book.community && (
                    <p className="text-sm text-muted-foreground">Public listing</p>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex-shrink-0 p-4 border-t border-border bg-card/50">
                <div className="flex gap-3">
                  {!isOwner && (
                    <button 
                      className="btn-hip flex-1 flex items-center justify-center gap-2"
                      onClick={() => onChat(book.owner_id, book.id)}
                    >
                      <MessageCircle className="w-4 h-4" />
                      Chat with Owner
                    </button>
                  )}
                  {isOwner && (
                    <div className="flex-1 text-center text-sm text-muted-foreground py-3">
                      This is your book
                    </div>
                  )}
                  <button className="p-3 rounded-2xl bg-muted text-muted-foreground hover:text-primary transition-colors">
                    <Heart className="w-5 h-5" />
                  </button>
                  <button className="p-3 rounded-2xl bg-muted text-muted-foreground hover:text-primary transition-colors">
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
