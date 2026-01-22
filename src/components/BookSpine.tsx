import { motion } from 'framer-motion';
import { Book } from '@/types/book';
import { Bookmark } from 'lucide-react';

interface BookSpineProps {
  book: Book;
  onClick: () => void;
  isSelected: boolean;
  isLent?: boolean;
  isBorrowed?: boolean;
  lenderNickname?: string;
}

const spineColors = [
  'bg-book-1',
  'bg-book-2',
  'bg-book-3',
  'bg-book-4',
  'bg-book-5',
  'bg-book-6',
];

export const BookSpine = ({ 
  book, 
  onClick, 
  isSelected,
  isLent = false,
  isBorrowed = false,
  lenderNickname,
}: BookSpineProps) => {
  const colorClass = spineColors[(book.spineColor - 1) % spineColors.length];
  
  return (
    <motion.div
      className={`book-spine cursor-pointer h-full min-w-[40px] max-w-[50px] flex-shrink-0 ${colorClass} rounded-sm flex items-center justify-center px-2 relative overflow-visible`}
      whileHover={{ 
        x: -8,
        transition: { duration: 0.2 }
      }}
      animate={isSelected ? { 
        x: -20,
        rotateY: -15,
        scale: 1.02,
      } : { 
        x: 0,
        rotateY: 0,
        scale: 1,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={onClick}
      style={{ perspective: '1000px' }}
    >
      {/* Lent tag */}
      {isLent && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-b-sm shadow-sm z-20">
          Lent
        </div>
      )}
      
      {/* Borrowed bookmark overlay */}
      {isBorrowed && lenderNickname && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
          <Bookmark className="w-6 h-8 text-primary fill-primary" />
          <span className="absolute top-1.5 text-[6px] font-bold text-primary-foreground leading-tight text-center px-0.5 max-w-[24px] truncate">
            {lenderNickname}
          </span>
        </div>
      )}
      
      {/* Spine texture overlay */}
      <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      {/* Book title */}
      <span className="text-white font-semibold text-xs tracking-wide truncate text-shadow-sm">
        {book.title}
      </span>
      
      {/* Edge highlight */}
      <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white/20" />
      <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-black/30" />
    </motion.div>
  );
};
