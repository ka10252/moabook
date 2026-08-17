import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface OptionButtonProps {
  label: string;
  /** 라벨 아래 작은 설명. 없으면 라벨만 */
  hint?: string;
  active: boolean;
  onClick: () => void;
  /**
   * 여러 개를 동시에 켤 수 있는 항목이면 true.
   * 켜졌을 때 체크 표시를 붙여 "고른 하나"가 아니라 "켜둔 것들"로 읽히게 한다 —
   * 거래 방식은 대여·나눔을 같이 켤 수 있어서 이 구분이 필요하다.
   */
  multi?: boolean;
}

/**
 * 등록 폼의 선택 버튼 — 거래 방식 · 상태 · 공개 범위가 모두 이걸 쓴다.
 *
 * 예전엔 셋이 각자 달랐다: 거래 방식은 코랄 테두리+연한 배경, 상태는 코랄 채움,
 * 공개 범위는 회색 트랙 위를 미끄러지는 세그먼트. 같은 성격의 결정 세 개가
 * 서로 다른 모양으로 말을 걸면, 유저는 각각을 새로 배워야 한다.
 *
 * 이제 껍데기(높이·모서리·글자)는 완전히 같고, **여러 개 선택인지 여부만** 체크 표시로 갈린다.
 */
export const OptionButton = ({ label, hint, active, onClick, multi }: OptionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      'relative min-h-11 py-2.5 px-1 rounded-[11px] border transition-colors text-center',
      active ? 'bg-primary border-primary' : 'bg-card border-border',
    )}
  >
    {multi && active && (
      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary-foreground/25 flex items-center justify-center">
        <Check className="w-2.5 h-2.5 text-primary-foreground" />
      </span>
    )}
    <span
      className={cn(
        'block text-[13px] font-bold leading-tight break-keep',
        active ? 'text-primary-foreground' : 'text-foreground',
      )}
    >
      {label}
    </span>
    {hint && (
      <span
        className={cn(
          'block text-[11px] mt-0.5 leading-tight break-keep',
          active ? 'text-primary-foreground/85' : 'text-faint',
        )}
      >
        {hint}
      </span>
    )}
  </button>
);
