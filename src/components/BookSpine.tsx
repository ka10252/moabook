import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { differenceInCalendarDays } from 'date-fns';
import { Book } from '@/types/book';
import { cleanBookTitle } from '@/lib/bookTitle';

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

/**
 * 세로쓰기 제목을 숫자 덩어리 기준으로 쪼갠다.
 *
 * 세로쓰기(vertical-rl)의 기본값은 숫자를 옆으로 눕힌다. 그런데 한 자리 숫자까지 눕히면
 * "현자의 질주 2"의 2만 혼자 누워 어색하다. 반대로 "1984", "82년생"처럼 여러 자리는
 * 세워서 한 글자씩 쌓으면 세로로 길어져 읽기 나쁘다.
 *   → 한 자리 숫자는 세우고(upright), 두 자리 이상은 눕힌다(기본값).
 */
const splitForVertical = (title: string) =>
  (title || '').split(/(\d+)/).filter(Boolean).map((part) => ({
    text: part,
    /** 한 자리 숫자만 세운다 */
    upright: /^\d$/.test(part),
  }));

/** 지금 빌릴 수 없는 책 (남이 이미 빌려간 상태) — 제목은 읽히되 비활성으로 보인다 */
const isUnavailable = (book: Book, isLent: boolean, isBorrowed: boolean) =>
  book.status === 'rented' && !isLent && !isBorrowed;

const spineColors = [
  'bg-book-1',
  'bg-book-2',
  'bg-book-3',
  'bg-book-4',
  'bg-book-5',
  'bg-book-6',
];

/**
 * 반납일 라벨.
 * `urgent`는 라벨 계산에만 남아 있고 색에는 쓰지 않는다 —
 * 반납이 임박해도 리본을 빨강으로 바꾸지 않는 것이 디자인 원칙이다(색으로 재촉하지 않는다).
 */
function getDDayLabel(returnDate: string | null | undefined): { label: string } | null {
  if (!returnDate) return null;
  const diff = differenceInCalendarDays(new Date(returnDate), new Date());
  if (diff > 7) return null;
  if (diff < 0) return { label: `D+${Math.abs(diff)}` };
  if (diff === 0) return { label: 'D-day' };
  return { label: `D-${diff}` };
}

/** 리본은 금색(빌려줌↑)/남색(빌림↓) 2종뿐. 상태별 색 분기는 없다. */
const RIBBON = {
  lent: {
    gradient: 'linear-gradient(180deg, #D4A827 0%, #A87010 55%, #7A4E08 100%)',
    chip: 'linear-gradient(135deg, #C68510, #8F5A05)',
    textColor: 'rgba(255,235,180,0.82)',
    arrow: '↑',
  },
  borrowed: {
    gradient: 'linear-gradient(180deg, #7478B8 0%, #484B8C 55%, #313468 100%)',
    chip: 'linear-gradient(135deg, #5658A0, #383A7E)',
    textColor: 'rgba(200,210,255,0.75)',
    arrow: '↓',
  },
};

/**
 * 책마다 높이가 다르다 — 실제 서가처럼 보이는 핵심.
 * 색과 마찬가지로 제목 해시로 결정론적으로 정해, 새로고침해도 같은 책은 같은 높이를 유지한다.
 */
const heightFromTitle = (title: string) => {
  const t = title || '';
  const hash = t.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 11);
  // 제목이 길수록 책등을 높게 → 한 열에 더 많은 글자가 …전에 보인다. + 약간의 해시 변주로 서가 느낌.
  const base = 74 + (hash % 4) * 3;                 // 74~83% 기본 변주
  const lengthBoost = Math.min(Math.max(t.length - 6, 0), 18) * 0.95; // 6자 넘으면 길이만큼 최대 +17%
  return Math.min(100, Math.round(base + lengthBoost));
};

/**
 * 세로 한 열에 담기게 제목을 맞춘다.
 *  · 짧은 책: 해시 변주 높이 그대로(서가에 높낮이 다양성).
 *  · 제목이 길어 그 높이에 안 들어가면, 필요한 만큼(최대 100%) 책등을 키워 전부 보여준다.
 *  · 가장 긴 책등(100%)으로도 넘치면 …로 자른다.
 * 상수는 책등 픽셀 높이(선반 h-184 - pt-6 = 약 160px 콘텐츠) 기준 근사치 — 필요 시 여기만 조정.
 */
const SHELF_CONTENT_PX = 160;
const PER_CHAR_PX = 14;   // 세로쓰기 한 글자당 세로 advance(≈ font-size)
const TOP_PX = 6;         // 상단 여백(mt-1.5)
const USABLE_PX = SHELF_CONTENT_PX * 0.92;
const CAP_AT_FULL = Math.floor((USABLE_PX - TOP_PX) / PER_CHAR_PX);  // 100% 책등에 담기는 글자 수
const heightNeeded = (len: number) => Math.ceil(((len * PER_CHAR_PX + TOP_PX) / USABLE_PX) * 100);

const fitTitle = (title: string): { heightPct: number; shown: string } => {
  const t = title || '';
  const need = heightNeeded(t.length);
  if (need <= 100) {
    // 해시 변주 높이와 '필요 높이' 중 큰 값 — 짧으면 변주, 길면 필요만큼.
    return { heightPct: Math.min(100, Math.max(heightFromTitle(t), need)), shown: t };
  }
  return { heightPct: 100, shown: t.slice(0, Math.max(1, CAP_AT_FULL - 1)).trimEnd() + '…' };
};

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
  // 표시용 제목 — (특별판)·[양장본] 등 판형 수식어 제거. 원본은 tooltip에 유지.
  const displayTitle = useMemo(() => cleanBookTitle(book.title), [book.title]);
  // 세로 한 열에 맞춘 표시 제목 + 그에 맞는 책등 높이(긴 제목은 가장 긴 책등 + …).
  const { heightPct, shown: shownTitle } = useMemo(() => fitTitle(displayTitle), [displayTitle]);

  const hasBookmark = (isLent && !!borrowerNickname) || (isBorrowed && !!lenderNickname);
  const chipName = isLent ? borrowerNickname : lenderNickname;
  const dday = useMemo(() => getDDayLabel(returnDate), [returnDate]);

  const r = isLent ? RIBBON.lent : RIBBON.borrowed;
  const unavailable = isUnavailable(book, isLent, isBorrowed);
  const titleParts = useMemo(() => splitForVertical(shownTitle), [shownTitle]);

  return (
    <motion.div
      className={`cursor-pointer flex-1 min-w-[26px] max-w-[52px] ${colorClass} flex items-center justify-center relative`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: unavailable ? -2 : -6, transition: { duration: 0.2 } }}
      animate={isSelected ? { y: -10, scale: 1.03 } : { y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={onClick}
      title={unavailable ? `${book.title} — 대여중` : undefined}
      style={{
        height: `${heightPct}%`,
        // 책은 바닥에 붙어 서 있다 — 위쪽만 둥글다
        borderRadius: '2px 2px 0 0',
        boxShadow: 'inset -3px 0 5px rgba(0,0,0,.2), inset 2px 0 2px rgba(255,255,255,.16)',
        outline: isLent ? '1px dashed #A89E88' : undefined,
        outlineOffset: isLent ? -2 : undefined,
        // 남이 빌려간 책 = 지금 빌릴 수 없음. 비활성으로 낮춰 보여준다(제목은 계속 읽힌다).
        opacity: unavailable ? 0.45 : 1,
        filter: unavailable ? 'saturate(0.6)' : undefined,
      }}
    >
      {/* ── Ghost in place ────────────────────────────────────────
          빌려준 책은 "자리를 지키되 비어 있음"으로 보인다.
          리본·이름칩은 이 오버레이보다 위(z-5/z-6)라 선명하게 남는다 —
          책은 비었어도 누가 가져갔는지, 돌아올 자리가 어딘지는 또렷해야 한다. */}
      {isLent && (
        <div
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{ background: 'rgba(244, 241, 234, 0.6)' }}
        />
      )}

      {/* ── 책등 제목 — 세로쓰기 한 줄 ─────────────────────────
          제목은 세로 한 열로만 흐른다. 길면 fitTitle이 미리 …로 잘라 넣으므로
          여기선 한 열 유지(maxWidth)와 넘침 방지(overflow)만 담당.
          전체 제목은 탭하면 상세에서 보인다(title 속성/tooltip 유지). */}
      <span
        title={book.title}
        className="relative z-[3] mt-1.5 text-[14px] overflow-hidden text-spine-text"
        style={{
          fontFamily: "'Noto Sans KR', sans-serif",
          fontWeight: 500,
          writingMode: 'vertical-lr',
          whiteSpace: 'nowrap',   // 한 열 고정(2열로 흐르지 않게)
          maxHeight: '92%',
          maxWidth: '1.3em',
          letterSpacing: '0.02em',
          lineHeight: 1.15,
          opacity: isLent ? 0.5 : 1,
        }}
      >
        {titleParts.map((part, i) =>
          part.upright ? (
            // 한 자리 숫자는 다른 글자처럼 똑바로 세운다
            <span key={i} style={{ textOrientation: 'upright' }}>
              {part.text}
            </span>
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </span>

      {/* ── Ribbon bookmark ───────────────────────────────────── */}
      {hasBookmark && (
        <motion.div
          className="absolute top-0 left-1/2 z-[5] pointer-events-none flex items-start justify-center"
          style={{
            x: '-50%',
            width: '64%',
            height: 34,
            background: r.gradient,
            clipPath: 'polygon(0 0, 100% 0, 100% 72%, 50% 100%, 0 72%)',
            boxShadow: '0 4px 9px rgba(0,0,0,0.3)',
            paddingTop: 4,
          }}
          animate={{ y: isHovered ? -3 : 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26 }}
        >
          {/* D-day — 색이 아니라 텍스트로만 알린다 */}
          {dday && (
            <span className="text-[10px] font-black leading-none" style={{ color: r.textColor }}>
              {dday.label}
            </span>
          )}
        </motion.div>
      )}

      {/* ── Name chip — 상시 노출 ─────────────────────────────── */}
      {hasBookmark && chipName && (
        <motion.div
          className="absolute left-1/2 z-[6] pointer-events-none flex items-center gap-[3px] rounded-full whitespace-nowrap text-white text-[10px] font-extrabold"
          style={{
            top: -15,
            x: '-50%',
            padding: '2px 6px',
            background: r.chip,
            boxShadow: '0 3px 7px rgba(0,0,0,0.28)',
          }}
          animate={{ scale: isHovered ? 1.08 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 26 }}
        >
          <span className="opacity-75">{r.arrow}</span>
          {chipName}
        </motion.div>
      )}

      {/* ── Duplicate count badge ─────────────────────────────── */}
      {(duplicateCount ?? 1) > 1 && !isHovered && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-[6] px-1.5 py-0.5 rounded-full text-[11px] font-black leading-none whitespace-nowrap pointer-events-none bg-white/85 text-foreground shadow-sm">
          ×{duplicateCount}
        </div>
      )}
    </motion.div>
  );
};
