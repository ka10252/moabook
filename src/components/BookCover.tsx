import { motion } from 'framer-motion';
import { formatPrice } from '@/lib/bookMode';
import { Book } from '@/types/book';
import { DefaultBookCover } from './DefaultBookCover';

interface BookCoverProps {
  book: Book;
  onClick: () => void;
  isRented?: boolean;
  isLent?: boolean;
  isBorrowed?: boolean;
}

export const BookCover = ({ book, onClick, isRented = false, isLent = false, isBorrowed = false }: BookCoverProps) => {
  const hasValidCover = book.cover && !book.cover.includes('unsplash.com/photo-1544947950');
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
        {hasValidCover ? (
          <img
            src={book.cover}
            alt={book.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <DefaultBookCover 
            title={book.title} 
            author={book.author} 
            className="w-full h-full"
          />
        )}
        
        {/* Status Badge */}
        {(isRented || isLent || isBorrowed) && (
          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-bold ${
            isLent ? 'bg-amber-500 text-white'
            : isBorrowed ? 'bg-amber-800 text-white'
            : 'bg-primary text-primary-foreground'
          }`}>
            {isLent ? '대여해줌' : isBorrowed ? '빌린책' : '대여중'}
          </div>
        )}
        
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
        
        {/* Mode badge — 판매는 가격(S$), 나눔은 '무료'. 대여는 배지 없음(기본값이라). */}
        {book.mode !== 'rent' && (
          <div className="absolute top-2 left-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground">
              {book.mode === 'sell' ? formatPrice(book.price) : '무료 나눔'}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
