import { Star } from 'lucide-react';

interface Props {
  value: number;
  /** 주면 입력용, 안 주면 표시 전용 */
  onChange?: (v: number) => void;
  size?: number;
  className?: string;
}

/**
 * 별 1~5.
 * 표시용일 땐 span, 입력용일 땐 button — 읽기만 하는 별에 포커스가 잡히면
 * 키보드로 넘길 때 별 다섯 개를 지나가야 한다.
 */
export function StarRating({ value, onChange, size = 18, className = '' }: Props) {
  const editable = !!onChange;
  return (
    <div className={`flex items-center gap-0.5 ${className}`} role={editable ? 'radiogroup' : undefined} aria-label={editable ? '별점' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = (
          <Star
            style={{ width: size, height: size }}
            className={filled ? 'fill-primary text-primary' : 'text-border'}
          />
        );
        return editable ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === Math.round(value)}
            aria-label={`${n}점`}
            onClick={() => onChange(n)}
            className="p-0.5 -m-0.5 rounded transition-transform active:scale-90 focus-visible:outline-2 focus-visible:outline-primary"
          >
            {star}
          </button>
        ) : (
          <span key={n} aria-hidden="true">{star}</span>
        );
      })}
    </div>
  );
}
