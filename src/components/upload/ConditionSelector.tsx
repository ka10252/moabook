import { cn } from '@/lib/utils';

type Condition = 'S' | 'A' | 'B';

interface ConditionSelectorProps {
  value: Condition;
  onChange: (condition: Condition) => void;
}

const conditions: { value: Condition; label: string; description: string }[] = [
  { value: 'S', label: 'S', description: '새 책' },
  { value: 'A', label: 'A', description: '양호' },
  { value: 'B', label: 'B', description: '보통' },
];

export const ConditionSelector = ({ value, onChange }: ConditionSelectorProps) => {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold tracking-wide text-muted-foreground">상태</p>
      <div className="flex gap-2">
        {conditions.map((condition) => {
          const isActive = value === condition.value;
          return (
            <button
              key={condition.value}
              type="button"
              onClick={() => onChange(condition.value)}
              className={cn(
                'flex-1 py-2.5 rounded-[11px] border transition-colors',
                isActive ? 'bg-primary border-primary' : 'bg-card border-border'
              )}
            >
              <span
                className={cn(
                  'block font-display text-[18px] leading-none',
                  isActive ? 'text-primary-foreground' : 'text-foreground'
                )}
              >
                {condition.label}
              </span>
              <span
                className={cn(
                  'block text-[9px] mt-1',
                  isActive ? 'text-primary-foreground/85' : 'text-faint'
                )}
              >
                {condition.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
