import { motion } from 'framer-motion';
import { Book } from '@/data/books';

interface BookCoverProps {
  book: Book;
  onClick: () => void;
}

export const BookCover = ({ book, onClick }: BookCoverProps) => {
  return (
    <motion.div
      className="relative cursor-pointer group"
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={onClick}
    >
      {/* Book shadow */}
      <div className="absolute -bottom-3 left-2 right-2 h-4 bg-black/20 blur-md rounded-full" />
      
      {/* Book cover */}
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-hip-lg">
        <img
          src={book.cover}
          alt={book.title}
          className="w-full h-full object-cover"
        />
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Book info on hover */}
        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <p className="text-white font-semibold text-sm line-clamp-1">{book.title}</p>
          <p className="text-white/70 text-xs">{book.author}</p>
        </div>
        
        {/* Condition badge */}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            book.condition === 'S' 
              ? 'bg-accent text-accent-foreground' 
              : book.condition === 'A'
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}>
            {book.condition}
          </span>
        </div>
        
        {/* Mode badge */}
        {book.mode === 'sell' && (
          <div className="absolute top-2 left-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground">
              ${book.price}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
