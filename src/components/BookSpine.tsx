import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { differenceInCalendarDays } from 'date-fns';
import { Book } from '@/types/book';
import { cleanBookTitle } from '@/lib/bookTitle';
import { spineColorFor } from '@/lib/coverColor';

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
 * 제목 길이 하나가 글자 크기 · 책등 두께 · 책등 높이를 모두 정한다.
 *
 *   제목이 길수록 → 글자가 작아지고 → 책등이 얇아지고 → 길어진다
 *
 * 글자를 줄이면 세로로 더 많이 들어가고, 글자 폭이 줄어드니 책등도 얇아진다.
 * 두께가 제각각이라 서가에 리듬이 생기는 건 덤이다(예전엔 전부 같은 폭이었다).
 *
 * ⚠️ 아래 숫자는 **브라우저에서 실제로 잰 값**이다. 눈대중으로 바꾸면 제목이 다시 잘린다.
 *    확인: `npm run audit:spine` — 글자 영역(clientHeight)과 실제 글자 길이(scrollHeight)를
 *    비교해 잘린 책을 찍어준다.
 *
 * 지난번 계산이 틀렸던 두 가지(다시 밟지 말 것):
 *   1. 100% 책등의 글자 영역을 160×0.92=147 로 어림했다 → 실제는 **145px**
 *   2. **공백을 반각(0.55칸)으로 셌다** → 세로쓰기에서 공백은 0.30칸뿐이다.
 */
const SPAN_MAX_PX = 145;      // heightPct=100 일 때 글자가 들어가는 세로 길이 (측정값)
const LINE_RESERVE = 20;      // 위아래 장식 선이 차지하는 몫 — 글자가 선에 닿지 않게
const SAFETY_PX = 3;

/** 글자 하나가 세로로 차지하는 길이. 글자 크기에 비례한다. */
const advanceAt = (ch: string, font: number) => {
  if (ch === ' ') return font * 0.30;
  const code = ch.charCodeAt(0);
  if (code >= 128) return font * 1.02;              // 전각 = font-size + letter-spacing(0.02em)
  if (ch >= '0' && ch <= '9') return font * 0.59;
  if (/[a-zA-Z]/.test(ch)) return font * 0.56;
  return font * 0.32;                                // 문장부호
};

/** 글자 크기와 무관한 '길이 단위'. 1 = 한글 한 글자. */
const unitsOf = (t: string) => [...t].reduce((s, ch) => s + advanceAt(ch, 1), 0);

/** 제목 길이 → 글자 크기. 6자 이하 15px, 16자 이상 10.5px, 사이는 선형. */
const fontFor = (u: number) =>
  u <= 6 ? 15 : u >= 16 ? 10.5 : Math.round((15 - (u - 6) * 0.45) * 10) / 10;

/** 글자 크기 → 책등 두께. 글자 폭 + 좌우 여백. */
const widthFor = (font: number) => Math.round(font * 1.9 + 8);

export interface SpineMetrics {
  font: number;
  width: number;
  heightPct: number;
  shown: string;
}

/** 이 제목의 책등이 차지할 두께(px). 서가가 한 칸에 몇 권을 넣을지 계산할 때 쓴다. */
export const spineWidthFor = (title: string) => widthFor(fontFor(unitsOf(cleanBookTitle(title || ''))));

const fitTitle = (title: string): SpineMetrics => {
  const t = title || '';
  const u = unitsOf(t);
  const font = fontFor(u);
  const width = widthFor(font);
  const usable = SPAN_MAX_PX - LINE_RESERVE - SAFETY_PX;
  const textPx = u * advanceAt('가', font);

  if (textPx <= usable) {
    const need = Math.ceil(((textPx + LINE_RESERVE) / SPAN_MAX_PX) * 100) + 1;
    return { font, width, heightPct: Math.min(100, Math.max(heightFromTitle(t), need)), shown: t };
  }

  // 가장 긴 책등으로도 안 담기는 제목 — '…' 자리를 남기고 자른다
  let acc = 0, out = '';
  for (const ch of t) {
    const w = advanceAt(ch, font);
    if (acc + w > usable - font) break;
    acc += w; out += ch;
  }
  return { font, width, heightPct: 100, shown: out.trimEnd() + '…' };
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
  // 책등 색은 **표지에서 뽑은 색상(H)** 으로 만든다. 채도·명도는 우리가 정한 사다리에서 —
  // 표지색을 통째로 쓰면 탁한 표지가 탁한 책등이 되고, 밝은 표지에서는 제목이 사라진다.
  const color = useMemo(
    () => spineColorFor(book.title || book.id, book.coverHue),
    [book.title, book.id, book.coverHue],
  );
  // 표시용 제목 — (특별판)·[양장본] 등 판형 수식어 제거. 원본은 tooltip에 유지.
  const displayTitle = useMemo(() => cleanBookTitle(book.title), [book.title]);
  // 세로 한 열에 맞춘 표시 제목 + 그에 맞는 책등 높이(긴 제목은 가장 긴 책등 + …).
  const { heightPct, width, font, shown: shownTitle } = useMemo(() => fitTitle(displayTitle), [displayTitle]);

  const hasBookmark = (isLent && !!borrowerNickname) || (isBorrowed && !!lenderNickname);
  const chipName = isLent ? borrowerNickname : lenderNickname;
  const dday = useMemo(() => getDDayLabel(returnDate), [returnDate]);

  const r = isLent ? RIBBON.lent : RIBBON.borrowed;
  const unavailable = isUnavailable(book, isLent, isBorrowed);
  const titleParts = useMemo(() => splitForVertical(shownTitle), [shownTitle]);

  return (
    <motion.div
      /* 두께는 제목 길이가 정한다 (fitTitle) — 예전엔 flex-1 로 다 같은 폭이었다 */
      className="cursor-pointer shrink-0 flex items-center justify-center relative overflow-hidden" 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: unavailable ? -2 : -6, transition: { duration: 0.2 } }}
      animate={isSelected ? { y: -10, scale: 1.03 } : { y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={onClick}
      title={unavailable ? `${book.title} — 대여중` : undefined}
      style={{
        height: `${heightPct}%`,
        width: `${width}px`,
        background: color.bg,
        // 책은 바닥에 붙어 서 있다 — 위쪽만 둥글다
        borderRadius: '2px 2px 0 0',
        // 파스텔 책등에는 짙은 그림자가 때를 탄 것처럼 보인다 — 옅게, 하이라이트는 세게.
        boxShadow: 'inset -3px 0 5px rgba(0,0,0,.14), inset 2px 0 2px rgba(255,255,255,.22)',
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
          // 파스텔 책등은 원래 밝아서, 예전 값(0.6)으로 덮으면 책이 통째로 사라진다.
          // '비어 있음'은 알리되 어떤 책이 나갔는지는 읽혀야 한다.
          style={{ background: 'rgba(244, 241, 234, 0.42)' }}
        />
      )}

      {/* 종이 결 — 색만 바꾸면 '예쁜 납작한 사각형'이 된다. 아주 옅은 세로 결로 재질을 준다. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          opacity: 0.5,
          background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.06) 0 1px, transparent 1px 3px)',
        }}
      />

      {/* 위아래 장식 선 — 실제 양장본의 박(箔) 띠. 배경 명도에 따라 밝게/어둡게 뒤집힌다. */}
      {[true, false].map((top) => (
        <span
          key={top ? 't' : 'b'}
          aria-hidden="true"
          className="absolute z-[2] pointer-events-none"
          style={{
            left: '14%', right: '14%', height: 2.5, borderRadius: 2,
            background: color.line,
            ...(top ? { top: 9 } : { bottom: 9 }),
          }}
        />
      ))}

      {/* ── 책등 제목 — 세로쓰기 한 줄 ─────────────────────────
          제목은 세로 한 열로만 흐른다. 길면 fitTitle이 미리 …로 잘라 넣으므로
          여기선 한 열 유지(maxWidth)와 넘침 방지(overflow)만 담당.
          전체 제목은 탭하면 상세에서 보인다(title 속성/tooltip 유지). */}
      <span
        title={book.title}
        className="relative z-[3] overflow-hidden"
        style={{
          fontFamily: "'Noto Sans KR', sans-serif",
          // 크기·굵기는 fitTitle 의 계산 전제다. 바꾸면 위 상수도 다시 재야 한다.
          fontSize: `${font}px`,
          fontWeight: 400,
          color: color.fg,
          writingMode: 'vertical-lr',
          whiteSpace: 'nowrap',   // 한 열 고정(2열로 흐르지 않게)
          maxHeight: '92%',
          maxWidth: '1.35em',
          letterSpacing: '0.02em',
          lineHeight: 1.15,
          opacity: isLent ? 0.62 : 1,
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
            <span className="text-[9px] font-black leading-none" style={{ color: r.textColor }}>
              {dday.label}
            </span>
          )}
        </motion.div>
      )}

      {/* ── Name chip — 상시 노출 ─────────────────────────────── */}
      {hasBookmark && chipName && (
        <motion.div
          className="absolute left-1/2 z-[6] pointer-events-none flex items-center gap-[3px] rounded-full whitespace-nowrap text-white text-[9px] font-extrabold"
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
