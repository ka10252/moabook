import { ReactNode } from 'react';

interface EditorialShelfProps {
  children: ReactNode;
  /** 선반 위 섹션 라벨 (예: "내 서가") — Instrument Serif italic */
  label?: string;
}

/**
 * 에디토리얼 미니멀 서가.
 *
 * 나무 판자가 아니다. 책은 크림 배경 위에 서 있고, 바닥은
 *   ① 2px 잉크 선  ② 7px 크림 선반
 * 두 겹으로만 표현된다. 책의 물성은 서가가 아니라 책등 자체가 만든다.
 */
export const EditorialShelf = ({ children, label }: EditorialShelfProps) => (
  <div>
    {label && (
      <p className="font-display italic text-[15px] text-foreground mb-0.5">{label}</p>
    )}

    {/* 책이 서는 자리 — 아래 정렬(flex-end)이라 책마다 높이가 달라도 바닥이 맞는다 */}
    <div className="flex items-end gap-1.5 h-[184px] pt-6">{children}</div>

    {/* 바닥: 잉크 선 + 크림 선반 */}
    <div className="h-[2px] bg-foreground" />
    <div
      className="h-[7px]"
      style={{
        background: 'linear-gradient(#DDD6C4, #EFE9DB)',
        boxShadow: '0 5px 9px -4px rgba(90, 70, 40, 0.4)',
      }}
    />
  </div>
);
