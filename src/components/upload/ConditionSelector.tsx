import { CONDITIONS, type BookCondition } from '@/lib/bookCondition';
import { OptionButton } from './OptionButton';

interface ConditionSelectorProps {
  value: BookCondition;
  onChange: (condition: BookCondition) => void;
}

/** 네 칸을 한 줄에. '사용감 많음'이 길어서 break-keep으로 단어를 안 쪼갠다(OptionButton). */
export const ConditionSelector = ({ value, onChange }: ConditionSelectorProps) => (
  <div className="space-y-2">
    <p className="text-[13px] font-bold tracking-wide text-muted-foreground">상태</p>
    <div className="grid grid-cols-4 gap-2">
      {CONDITIONS.map((condition) => (
        <OptionButton
          key={condition.value}
          label={condition.label}
          active={value === condition.value}
          onClick={() => onChange(condition.value)}
        />
      ))}
    </div>
  </div>
);
