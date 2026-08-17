import { ReactNode } from 'react';

interface EditorialShelfProps {
  children: ReactNode;
  /** 선반 위 섹션 라벨 (예: "내 서가") — Instrument Serif italic */
  label?: string;
  /**
   * 책이 서는 자리의 높이(px). 기본 184.
   * 빈 칸으로 화면을 채울 때만 넘긴다 — 남는 높이를 칸들이 나눠 가져
   * 서가 아래에 빈 배경이 남지 않게 한다.
   */
  bookAreaH?: number;
}

/**
 * 라이트 내추럴 우드 서가의 "한 칸"(시안 F).
 *
 * 모서리·테두리는 이 컴포넌트가 아니라 바깥 서가 프레임(Bookshelf)이 담당한다.
 * 여기서는 뒷판(stage) + 나뭇결 선반(plank)만 그려서, 칸을 여러 개 붙이면
 * 하나의 통짜 책꽂이처럼 이어지게 한다. 라이트/다크 테마 모두 대응.
 */
export const EditorialShelf = ({ children, label, bookAreaH = 184 }: EditorialShelfProps) => (
  <div>
    {/* 뒷판 — 옅은 우드 그라데이션 (모서리 없음) */}
    <div className="px-3 pt-2.5 bg-gradient-to-b from-[#EFE3CE] to-[#F6EEDE] dark:from-[#2b2418] dark:to-[#332a1b]">
      {label && (
        <p className="font-display italic text-[17px] text-foreground mb-0.5">{label}</p>
      )}

      {/* 책이 서는 자리 — 아래 정렬(flex-end)이라 책마다 높이가 달라도 바닥이 맞는다 */}
      <div className="flex items-end gap-1.5 pt-6" style={{ height: bookAreaH }}>{children}</div>
    </div>

    {/* 나뭇결 선반 — 칸과 칸을 나누는 가로 판. 아래로 은은한 그림자를 드리운다 */}
    <div
      className="h-[13px] bg-gradient-to-b from-[#E6CFA3] to-[#CBAF84]"
      style={{ boxShadow: '0 6px 9px -6px rgba(120, 95, 55, 0.4)' }}
    />
  </div>
);
