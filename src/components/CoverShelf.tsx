import { ReactNode } from 'react';

interface CoverShelfProps {
  /** 3권까지 */
  children: ReactNode;
  label?: string;
}

/**
 * 표지 보기의 서가 한 칸(F18). `EditorialShelf`(책등)의 표지판.
 *
 * 표지는 원본 비율이 제각각이라 그냥 늘어놓으면 아래가 들쭉날쭉해서
 * 선반 판 위에 얹힌 것처럼 보이지 않는다. 그래서 칸 높이를 고정하고
 * `items-end`로 바닥을 맞춘다 — 책이 선반에 '서 있는' 느낌은 바닥선이 만든다.
 *
 * 한 줄이 3권을 못 채워도 grid-cols-3를 유지한다. flex로 벌리면
 * 2권짜리 줄에서 책이 가운데로 몰려 칸이 어긋나 보인다.
 */
export const CoverShelf = ({ children, label }: CoverShelfProps) => (
  <div>
    <div className="px-3 pt-2.5 bg-gradient-to-b from-[#EFE3CE] to-[#F6EEDE] dark:from-[#2b2418] dark:to-[#332a1b]">
      {label && (
        <p className="font-display italic text-[17px] text-foreground mb-0.5">{label}</p>
      )}
      <div className="grid grid-cols-3 gap-x-3 items-end pt-3 pb-1">{children}</div>
    </div>

    <div
      className="h-[13px] bg-gradient-to-b from-[#E6CFA3] to-[#CBAF84]"
      style={{ boxShadow: '0 6px 9px -6px rgba(120, 95, 55, 0.4)' }}
    />
  </div>
);
