import { useState } from 'react';
import { motion } from 'framer-motion';
import { Book } from '@/types/book';

interface BookSpineProps {
  book: Book;
  onClick: () => void;
  isSelected: boolean;
  isLent?: boolean;
  isBorrowed?: boolean;
  borrowerNickname?: string;
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
  borrowerNickname,
  lenderNickname,
}: BookSpineProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const colorClass = spineColors[(book.spineColor - 1) % spineColors.length];
  
  // Get bookmark text based on status
  const getLentBookmarkText = (name: string) => `${name}이 대여중`;
  const getBorrowedBookmarkText = (name: string) => `${name}꺼`;
  
  const hasBookmark = (isLent && borrowerNickname) || (isBorrowed && lenderNickname);
  
  return (
    <motion.div
      className={`book-spine cursor-pointer h-full min-w-[40px] max-w-[50px] flex-shrink-0 ${colorClass} rounded-sm flex items-center justify-center px-2 relative overflow-visible`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
      {/* Lent Bookmark - Yellow - when user lent their book to someone */}
      {isLent && borrowerNickname && (
        <motion.div 
          className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center"
          style={{ 
            width: '38px',
            transformOrigin: 'top right',
          }}
          animate={{
            rotate: isHovered ? -18 : 0,
            x: isHovered ? '-35%' : '-50%',
          }}
          transition={{ 
            type: 'spring', 
            stiffness: 300, 
            damping: 20,
            duration: 0.3
          }}
        >
          {/* Yellow ribbon bookmark shape */}
          <div 
            className="relative bg-bookmark-lent shadow-lg box-border"
            style={{
              width: '100%',
              minHeight: '48px',
              clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
            }}
          >
            {/* Texture overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/15 via-transparent to-black/10" />
            
            {/* Fold effect */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-b from-white/30 to-transparent" />
            
            {/* Bookmark text - vertical */}
            <div className="absolute inset-0 flex items-center justify-center pt-1 pb-3">
              <motion.span 
                className="text-[7px] font-bold text-bookmark-lent-foreground text-center leading-tight whitespace-nowrap overflow-hidden"
                style={{ 
                  textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                }}
                animate={{
                  opacity: isHovered ? 0.4 : 1,
                }}
                transition={{ duration: 0.2 }}
              >
                {getLentBookmarkText(borrowerNickname)}
              </motion.span>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Borrowed Bookmark - Brown - when user borrowed this book from someone */}
      {isBorrowed && lenderNickname && (
        <motion.div 
          className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center"
          style={{ 
            width: '38px',
            transformOrigin: 'top right',
          }}
          animate={{
            rotate: isHovered ? -18 : 0,
            x: isHovered ? '-35%' : '-50%',
          }}
          transition={{ 
            type: 'spring', 
            stiffness: 300, 
            damping: 20,
            duration: 0.3
          }}
        >
          {/* Brown ribbon bookmark shape */}
          <div 
            className="relative bg-bookmark-borrowed shadow-lg box-border"
            style={{
              width: '100%',
              minHeight: '48px',
              clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
            }}
          >
            {/* Texture overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-black/15" />
            
            {/* Fold effect */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-b from-white/20 to-transparent" />
            
            {/* Bookmark text - vertical */}
            <div className="absolute inset-0 flex items-center justify-center pt-1 pb-3">
              <motion.span 
                className="text-[7px] font-bold text-bookmark-borrowed-foreground text-center leading-tight whitespace-nowrap overflow-hidden"
                style={{ 
                  textShadow: '0 1px 1px rgba(0,0,0,0.3)',
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                }}
                animate={{
                  opacity: isHovered ? 0.4 : 1,
                }}
                transition={{ duration: 0.2 }}
              >
                {getBorrowedBookmarkText(lenderNickname)}
              </motion.span>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Spine texture overlay */}
      <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      {/* Book title - always visible, fully visible on hover when bookmark tilts away */}
      <motion.span 
        className="text-white font-semibold text-xs tracking-wide truncate text-shadow-sm relative z-10"
        animate={{
          opacity: hasBookmark && !isHovered ? 0.6 : 1,
        }}
        transition={{ duration: 0.2 }}
      >
        {book.title}
      </motion.span>
      
      {/* Edge highlight */}
      <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white/20" />
      <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-black/30" />
    </motion.div>
  );
};
