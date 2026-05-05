import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Users, Heart, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STEPS = [
  {
    icon: BookOpen,
    title: '책장에 책을 꽂아보세요',
    desc: '내가 가진 책을 등록하면\n책등으로 예쁘게 진열됩니다.',
    color: 'bg-book-1',
  },
  {
    icon: Users,
    title: '커뮤니티로 이웃과 나눠요',
    desc: '독서 모임이나 친구들과\n비공개 공간을 만들어 책을 나눠보세요.',
    color: 'bg-book-3',
  },
  {
    icon: Heart,
    title: '빌리고 싶은 책에 ♥',
    desc: '다른 사람 책에 좋아요를 누르면\n내 책장 상단에 고정됩니다.',
    color: 'bg-book-5',
  },
];

interface OnboardingModalProps {
  onComplete: () => void;
}

export const OnboardingModal = ({ onComplete }: OnboardingModalProps) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-6">
      {/* Step dots */}
      <div className="flex gap-2 mb-10">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col items-center text-center gap-6 max-w-xs"
        >
          <div className={`w-24 h-24 rounded-3xl ${current.color} flex items-center justify-center shadow-lg`}>
            <Icon className="w-12 h-12 text-white" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">{current.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{current.desc}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-12 flex flex-col items-center gap-3 w-full max-w-xs">
        <Button
          className="w-full h-12 rounded-2xl gap-2"
          onClick={() => {
            if (isLast) {
              onComplete();
            } else {
              setStep(s => s + 1);
            }
          }}
        >
          {isLast ? (
            <>
              <Check className="w-4 h-4" />
              시작하기
            </>
          ) : (
            <>
              다음
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
        <button
          onClick={onComplete}
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          건너뛰기
        </button>
      </div>
    </div>
  );
};
