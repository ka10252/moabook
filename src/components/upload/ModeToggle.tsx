import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { BookMode, MODE_LABEL } from '@/lib/bookMode';

interface ModeToggleProps {
  allowRent: boolean;
  allowSell: boolean;
  allowGive: boolean;
  /** 해당 방식 켜고/끄기 */
  onToggle: (mode: BookMode) => void;
}

/** 대여·나눔은 무료, 판매만 돈이 오간다. 여러 방식 동시 선택 가능. */
const MODES: { value: BookMode; hint: string }[] = [
  { value: 'rent', hint: '무료 · 돌려받음' },
  { value: 'give', hint: '무료 · 그냥 드림' },
  { value: 'sell', hint: 'S$ · 판매' },
];

export const ModeToggle = ({ allowRent, allowSell, allowGive, onToggle }: ModeToggleProps) => {
  const on: Record<BookMode, boolean> = { rent: allowRent, sell: allowSell, give: allowGive };
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-bold tracking-wide text-muted-foreground">거래 방식 <span className="text-faint font-medium">(여러 개 선택 가능)</span></p>
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((mode) => {
          const isActive = on[mode.value];
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => onToggle(mode.value)}
              className={cn(
                'relative py-2.5 rounded-[11px] border transition-colors text-center',
                isActive ? 'border-primary bg-primary/10' : 'border-border bg-muted/40'
              )}
            >
              {isActive && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </span>
              )}
              <span className={cn('block text-xs', isActive ? 'text-primary font-bold' : 'text-muted-foreground font-semibold')}>
                {MODE_LABEL[mode.value]}
              </span>
              <span className={cn('block text-[11px] mt-0.5', isActive ? 'text-primary/80' : 'text-faint')}>
                {mode.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
