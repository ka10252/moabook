import { Check, Circle } from 'lucide-react';
import { PASSWORD_RULES } from '@/lib/passwordSchema';
import { cn } from '@/lib/utils';

interface PasswordRequirementsProps {
  value: string;
}

export const PasswordRequirements = ({ value }: PasswordRequirementsProps) => {
  if (!value) return null;

  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 pt-2 pl-1">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(value);
        return (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-1 text-[11px] transition-colors',
              passed ? 'text-primary font-medium' : 'text-muted-foreground'
            )}
          >
            {passed ? (
              <Check className="w-3 h-3" />
            ) : (
              <Circle className="w-2.5 h-2.5" />
            )}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
};
