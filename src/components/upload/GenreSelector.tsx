import { ChevronDown, Tag } from 'lucide-react';
import { useState } from 'react';
import { GENRES, type Genre } from '@/lib/genre';

interface GenreSelectorProps {
  value: Genre;
  onChange: (genre: Genre) => void;
  /** 검색으로 자동 판별된 값인지 — 사람이 손대기 전이라는 표시 */
  auto?: boolean;
}

/**
 * 장르 고르기 — 하나만 고르는 드롭다운.
 *
 * 상태(4칸)처럼 버튼을 늘어놓지 않는 이유: 장르는 11칸이라 격자로 깔면
 * 등록 화면에서 가장 큰 덩어리가 되어버린다. 게다가 검색으로 이미 채워져 있어
 * **대부분 열어볼 일이 없다.** 접힌 한 줄로 두고, 틀렸을 때만 열게 한다.
 */
export const GenreSelector = ({ value, onChange, auto }: GenreSelectorProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-bold tracking-wide text-muted-foreground">장르</p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full min-h-11 flex items-center justify-between gap-2 px-3 py-2 text-[13px] rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-foreground font-medium truncate">{value}</span>
          {auto && <span className="text-[11px] text-muted-foreground shrink-0">· 자동</span>}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            {GENRES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => { onChange(g); setOpen(false); }}
                className={`w-full min-h-11 flex items-center px-3 py-2.5 text-[13px] text-left transition-colors ${
                  g === value
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'bg-card hover:bg-muted/60 text-foreground/80'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
