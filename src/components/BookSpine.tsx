import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInCalendarDays } from 'date-fns';
import { Book } from '@/types/book';

interface BookSpineProps {
  book: Book;
  onClick: () => void;
  isSelected: boolean;
  isLent?: boolean;
  isBorrowed?: boolean;
  borrowerNickname?: string;
  lenderNickname?: string;
  returnDate?: string | null;
  duplicateCount?: number;
}

const spineColors = [
  'bg-book-1',
  'bg-book-2',
  'bg-book-3',
  'bg-book-4',
  'bg-book-5',
  'bg-book-6',
];

const BOOKMARK_WIDTH = 26;
const BOOKMARK_HEIGHT = 38;
const BOOKMARK_CLIP = 'polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%)';

function getDDayLabel(returnDate: string | null | undefined): { label: string; urgent: boolean } | null {
  if (!returnDate) return null;
  const diff = differenceInCalendarDays(new Date(returnDate), new Date());
  if (diff > 7) return null; // only show badge when ≤7 days left or overdue
  if (diff < 0) return { label: `D+${Math.abs(diff)}`, urgent: true };
  if (diff === 0) return { label: 'D-day', urgent: true };
  return { label: `D-${diff}`, urgent: diff <= 3 };
}

export const BookSpine = ({
  book,
  onClick,
  isSelected,
  isLent = false,
  isBorrowed = false,
  borrowerNickname,
  lenderNickname,
  returnDate,
  duplicateCount,
}: BookSpineProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const colorClass = spineColors[(book.spineColor - 1) % spineColors.length];

  const hasBookmark = (isLent && borrowerNickname) || (isBorrowed && lenderNickname);
  const chipName = isLent ? borrowerNickname : lenderNickname;

  const dday = useMemo(() => getDDayLabel(returnDate), [returnDate]);

  return (
    <motion.div
      className={`book-spine cursor-pointer h-full min-w-[40px] max-w-[50px] flex-shrink-0 ${colorClass} rounded-sm flex items-center justify-center px-2 py-3 relative overflow-visible`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{
        x: -8,
        rotate: 0,
        transition: { duration: 0.2 },
      }}
      animate={
        isSelected
          ? { x: -20, rotateY: -15, scale: 1.02, rotate: 0 }
          : { x: 0, rotateY: 0, scale: 1, rotate: isBorrowed ? -5 : 0 }
      }
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={onClick}
      style={{ perspective: '1000px', transformOrigin: 'bottom center' }}
    >
      {/* ── D-day badge ────────────────────────────────────────── */}
      {dday && !isHovered && (
        <div
          className={`absolute top-1 left-1/2 -translate-x-1/2 z-30 px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none whitespace-nowrap pointer-events-none ${
            dday.urgent
              ? 'bg-red-500 text-white'
              : 'bg-yellow-400 text-yellow-900'
          }`}
        >
          {dday.label}
        </div>
      )}

      {/* ── Floating name chip (shown on hover) ───────────────── */}
      <AnimatePresence>
        {isHovered && hasBookmark && chipName && (
          <motion.div
            className="absolute left-1/2 z-30 pointer-events-none"
            style={{ top: `-${BOOKMARK_HEIGHT + 28}px`, x: '-50%' }}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full shadow-lg whitespace-nowrap text-white text-[10px] font-bold ${
                isLent
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                  : 'bg-gradient-to-r from-indigo-400 to-indigo-600'
              }`}
            >
              <span className="opacity-80">{isLent ? '↑' : '↓'}</span>
              <span>{chipName}</span>
              {dday && (
                <span className={`ml-1 px-1 rounded text-[9px] ${dday.urgent ? 'bg-red-500/80' : 'bg-yellow-400/80 text-yellow-900'}`}>
                  {dday.label}
                </span>
              )}
            </div>
            <div
              className="mx-auto mt-0.5"
              style={{
                width: 8,
                height: 5,
                background: isLent ? '#f59e0b' : '#6366f1',
                clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Lent bookmark (amber) ──────────────────────────────── */}
      {isLent && borrowerNickname && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 z-20"
          style={{ top: -BOOKMARK_HEIGHT + 10, width: BOOKMARK_WIDTH }}
          animate={{ y: isHovered ? -5 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        >
          <div
            className="relative shadow-md"
            style={{
              width: '100%',
              height: BOOKMARK_HEIGHT,
              background: 'linear-gradient(160deg, #fcd34d 0%, #f59e0b 60%, #d97706 100%)',
              clipPath: BOOKMARK_CLIP,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/10" />
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/40 rounded-t-sm" />
            <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: BOOKMARK_HEIGHT * 0.22 }}>
              <span className="font-black text-amber-900/60 select-none" style={{ fontSize: 11, lineHeight: 1 }}>↑</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Borrowed bookmark (indigo) ─────────────────────────── */}
      {isBorrowed && lenderNickname && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 z-20"
          style={{ top: -BOOKMARK_HEIGHT + 10, width: BOOKMARK_WIDTH }}
          animate={{ y: isHovered ? -5 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        >
          <div
            className="relative shadow-md"
            style={{
              width: '100%',
              height: BOOKMARK_HEIGHT,
              background: 'linear-gradient(160deg, #a5b4fc 0%, #6366f1 60%, #4f46e5 100%)',
              clipPath: BOOKMARK_CLIP,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/15" />
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/35 rounded-t-sm" />
            <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: BOOKMARK_HEIGHT * 0.22 }}>
              <span className="font-black text-indigo-900/50 select-none" style={{ fontSize: 11, lineHeight: 1 }}>↓</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Duplicate count badge ─────────────────────────── */}
      {(duplicateCount ?? 1) > 1 && !isHovered && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-30 px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none whitespace-nowrap pointer-events-none bg-white/85 text-foreground shadow-sm">
          ×{duplicateCount}
        </div>
      )}

      {/* Spine texture */}
      <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Book title */}
      <motion.span
        className="text-white font-semibold text-xs tracking-wide truncate text-shadow-sm relative z-10"
        animate={{ opacity: hasBookmark && !isHovered ? 0.65 : 1 }}
        transition={{ duration: 0.2 }}
      >
        {book.title}
      </motion.span>

      {/* Edge highlights */}
      <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white/20" />
      <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-black/30" />
    </motion.div>
  );
};
