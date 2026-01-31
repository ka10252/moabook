import { useState } from 'react';
import { motion } from 'framer-motion';
import { Book } from '@/types/book';

interface BookSpineProps {
  book: Book;
  onClick: () => void;
  isSelected: boolean;
  isLent?: boolean;
  isBorrowed?: boolean;
  isRented?: boolean; // Book is currently rented out (대여중)
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
  isRented = false,
  lenderNickname,
}: BookSpineProps) => {
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);
  const colorClass = spineColors[(book.spineColor - 1) % spineColors.length];
  
  // Calculate dynamic bookmark width based on nickname length
  const getBookmarkWidth = (name: string) => {
    const baseWidth = 28;
    const charWidth = 5;
    const padding = 16;
    return Math.min(Math.max(baseWidth, name.length * charWidth + padding), 80);
  };
  
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
      {/* Lent tag - when user lent their book to someone */}
      {isLent && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-b-sm shadow-sm z-20">
          대여해줌
        </div>
      )}
      
      {/* Rented tag - when book is currently rented */}
      {isRented && !isLent && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[8px] font-bold px-1.5 py-0.5 rounded-b-sm shadow-sm z-20">
          대여중
        </div>
      )}
      
      {/* Borrowed bookmark overlay - tactile ribbon design with dynamic width */}
      {isBorrowed && lenderNickname && (
        <motion.div 
          className="absolute -top-2 left-1/2 z-20 flex flex-col items-center cursor-pointer"
          style={{ 
            x: '-50%',
            width: getBookmarkWidth(lenderNickname),
          }}
          onMouseEnter={() => setIsBookmarkHovered(true)}
          onMouseLeave={() => setIsBookmarkHovered(false)}
          animate={{
            opacity: isBookmarkHovered ? 0.3 : 1,
            y: isBookmarkHovered ? -4 : 0,
          }}
          transition={{ duration: 0.2 }}
        >
          {/* Ribbon bookmark shape */}
          <div 
            className="relative bg-gradient-to-b from-primary via-primary to-primary/90 shadow-lg"
            style={{
              width: '100%',
              minHeight: '36px',
              clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
            }}
          >
            {/* Texture overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-black/10" />
            
            {/* Fold effect */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-b from-white/20 to-transparent" />
            
            {/* Nickname text */}
            <span 
              className="absolute inset-x-0 top-1 text-[7px] font-bold text-primary-foreground text-center leading-tight px-1 truncate"
            >
              {lenderNickname}
            </span>
          </div>
        </motion.div>
      )}
      
      {/* Spine texture overlay */}
      <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      {/* Book title - fades in when bookmark is hovered */}
      <motion.span 
        className="text-white font-semibold text-xs tracking-wide truncate text-shadow-sm"
        animate={{
          opacity: isBorrowed && lenderNickname ? (isBookmarkHovered ? 1 : 0.7) : 1,
        }}
      >
        {book.title}
      </motion.span>
      
      {/* Edge highlight */}
      <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white/20" />
      <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-black/30" />
    </motion.div>
  );
};
