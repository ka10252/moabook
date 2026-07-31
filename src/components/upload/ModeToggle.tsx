import { cn } from '@/lib/utils';
import { BookMode, MODE_LABEL } from '@/lib/bookMode';

interface ModeToggleProps {
  value: BookMode;
  onChange: (mode: BookMode) => void;
}

/** 대여·나눔은 무료, 판매만 돈이 오간다 — 그 차이를 한 줄로 붙여 보여준다 */
const MODES: { value: BookMode; hint: string }[] = [
  { value: 'rent', hint: '무료 · 돌려받음' },
  { value: 'give', hint: '무료 · 그냥 드림' },
  { value: 'sell', hint: 'S$ · 판매' },
];

export const ModeToggle = ({ value, onChange }: ModeToggleProps) => {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-bold tracking-wide text-muted-foreground">거래 방식</p>
      <div className="flex bg-muted rounded-[11px] p-[3px]">
        {MODES.map((mode) => {
          const isActive = value === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => onChange(mode.value)}
              className={cn(
                'flex-1 py-2 rounded-[9px] transition-colors',
                isActive ? 'bg-primary' : ''
              )}
            >
              <span
                className={cn(
                  'block text-xs',
                  isActive ? 'text-primary-foreground font-bold' : 'text-muted-foreground font-semibold'
                )}
              >
                {MODE_LABEL[mode.value]}
              </span>
              <span
                className={cn(
                  'block text-[11px] mt-0.5',
                  isActive ? 'text-primary-foreground/85' : 'text-faint'
                )}
              >
                {mode.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
