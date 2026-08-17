import { Check, Circle } from 'lucide-react';
import { PASSWORD_RULES } from '@/lib/passwordSchema';
import { cn } from '@/lib/utils';

interface PasswordRequirementsProps {
  value: string;
}

export const PasswordRequirements = ({ value }: PasswordRequirementsProps) => {
  // 입력 전에도 항상 칸 하단에 보이게(조건 미충족은 회색). 한 줄에 담기게 nowrap.
  return (
    <ul className="flex flex-nowrap items-center gap-x-2.5 gap-y-0 pt-2 pl-1 overflow-hidden">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(value);
        return (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-1 text-[13px] whitespace-nowrap transition-colors',
              passed ? 'text-primary font-medium' : 'text-muted-foreground'
            )}
          >
            {passed ? (
              <Check className="w-3 h-3 shrink-0" />
            ) : (
              <Circle className="w-2.5 h-2.5 shrink-0" />
            )}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
};
