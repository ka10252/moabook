import { motion } from 'framer-motion';
import { Book } from '@/types/book';

interface BookSpineProps {
  book: Book;
  onClick: () => void;
  isSelected: boolean;
}

const spineColors = [
  'bg-book-1',
  'bg-book-2',
  'bg-book-3',
  'bg-book-4',
  'bg-book-5',
  'bg-book-6',
];

export const BookSpine = ({ book, onClick, isSelected }: BookSpineProps) => {
  const colorClass = spineColors[(book.spineColor - 1) % spineColors.length];
  
  return (
    <motion.div
      className={`book-spine cursor-pointer h-full min-w-[40px] max-w-[50px] flex-shrink-0 ${colorClass} rounded-sm flex items-center justify-center px-2 relative overflow-hidden`}
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
