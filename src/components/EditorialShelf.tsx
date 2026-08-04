import { ReactNode } from 'react';

interface EditorialShelfProps {
  children: ReactNode;
  /** 선반 위 섹션 라벨 (예: "내 서가") — Instrument Serif italic */
  label?: string;
}

/**
 * 라이트 내추럴 우드 서가 (시안 F).
 *
 * 밝은 자작나무 톤의 뒷판(stage) 위에 책이 서고, 아래에 나뭇결 선반(plank)이
 * 받쳐 준다. 배경 크림톤과 구분되는 "책꽂이 한 칸" 인상을 주되, 무겁지 않게.
 * 라이트/다크 테마 모두 대응한다.
 */
export const EditorialShelf = ({ children, label }: EditorialShelfProps) => (
  <div>
    {/* 뒷판 — 옅은 우드 그라데이션 + 얇은 테두리, 위쪽만 둥글게 */}
    <div className="rounded-t-xl border border-b-0 px-3 pt-2.5 bg-gradient-to-b from-[#EFE3CE] to-[#F6EEDE] border-[#E7D9BF] dark:from-[#2b2418] dark:to-[#332a1b] dark:border-[#3d3320]">
      {label && (
        <p className="font-display italic text-[16px] text-foreground mb-0.5">{label}</p>
      )}

      {/* 책이 서는 자리 — 아래 정렬(flex-end)이라 책마다 높이가 달라도 바닥이 맞는다 */}
      <div className="flex items-end gap-1.5 h-[184px] pt-6">{children}</div>
    </div>

    {/* 나뭇결 선반 */}
    <div
      className="h-[13px] rounded-b-lg bg-gradient-to-b from-[#E6CFA3] to-[#CBAF84]"
      style={{ boxShadow: '0 6px 9px -6px rgba(120, 95, 55, 0.4)' }}
    />
  </div>
);
