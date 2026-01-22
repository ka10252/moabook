import { motion } from 'framer-motion';
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
      <label className="text-sm font-medium text-foreground">책 상태</label>
      <div className="flex gap-2">
        {conditions.map((condition) => (
          <button
            key={condition.value}
            type="button"
            onClick={() => onChange(condition.value)}
            className={cn(
              "relative flex-1 py-3 px-4 rounded-xl border-2 transition-all duration-200",
              value === condition.value
                ? "border-primary bg-primary/10"
                : "border-border bg-secondary hover:border-muted-foreground"
            )}
          >
            {value === condition.value && (
              <motion.div
                layoutId="condition-indicator"
                className="absolute inset-0 rounded-xl bg-primary/10 border-2 border-primary"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <div className="relative flex flex-col items-center gap-1">
              <span className={cn(
                "text-lg font-bold",
                value === condition.value ? "text-primary" : "text-foreground"
              )}>
                {condition.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {condition.description}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
