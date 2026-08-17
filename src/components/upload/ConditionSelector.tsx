import { cn } from '@/lib/utils';
import { CONDITIONS, type BookCondition } from '@/lib/bookCondition';

interface ConditionSelectorProps {
  value: BookCondition;
  onChange: (condition: BookCondition) => void;
}

/**
 * 네 칸을 한 줄에 늘어놓는다. '사용감 많음'이 다른 것보다 길어서
 * flex-1로 균등 분배하면 두 줄로 접히므로 글자 크기를 조금 줄였다.
 */
export const ConditionSelector = ({ value, onChange }: ConditionSelectorProps) => {
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-bold tracking-wide text-muted-foreground">상태</p>
      <div className="grid grid-cols-4 gap-1.5">
        {CONDITIONS.map((condition) => {
          const isActive = value === condition.value;
          return (
            <button
              key={condition.value}
              type="button"
              onClick={() => onChange(condition.value)}
              className={cn(
                'py-2.5 px-1 rounded-[11px] border transition-colors',
                isActive ? 'bg-primary border-primary' : 'bg-card border-border'
              )}
            >
              <span
                className={cn(
                  'block text-[13px] font-bold leading-tight break-keep',
                  isActive ? 'text-primary-foreground' : 'text-foreground'
                )}
              >
                {condition.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
