import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X, ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StarRating } from './StarRating';
import { useBackClose } from '@/hooks/useBackClose';
import { MANNER_QUESTIONS, useMannerReview } from '@/hooks/useMannerReview';

interface Props {
  userId: string;
  nickname: string;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * F3 · 거래 상대 매너 평가.
 *
 * 별 세 개만 받고 서술형은 없다. 글을 쓰게 하면 대부분 그냥 닫고,
 * 쓰는 사람은 감정이 실린 글을 쓴다. 별점은 모이면 평균으로 눌리지만 글은 그렇지 않다.
 *
 * "익명입니다"를 상단에 크게 두는 이유 — 익명인 줄 모르면 나쁜 점수를 못 준다.
 * 실제로 매너 평가가 무너지는 건 대부분 이 지점이다.
 */
export function MannerReviewModal({ userId, nickname, onClose, onSaved }: Props) {
  const { role, canReview, myAnswers, hasReviewed, loading, submit } = useMannerReview(userId);
  const [answers, setAnswers] = useState<[number, number, number]>([0, 0, 0]);
  const [saving, setSaving] = useState(false);

  useBackClose(true, onClose);

  // 이미 남긴 평가가 있으면 그대로 채워 수정하게 한다
  useEffect(() => {
    if (myAnswers) setAnswers([myAnswers.q1, myAnswers.q2, myAnswers.q3]);
  }, [myAnswers]);

  const questions = MANNER_QUESTIONS[role ?? 'lender'];
  const allAnswered = answers.every((v) => v >= 1);

  const handleSave = async () => {
    if (!allAnswered) return;
    setSaving(true);
    const { error } = await submit({ q1: answers[0], q2: answers[1], q3: answers[2] });
    setSaving(false);
    if (error) {
      toast.error(error.message || '평가를 저장하지 못했습니다');
      return;
    }
    toast.success(hasReviewed ? '평가를 수정했습니다' : '평가를 남겼습니다');
    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-[420px] bg-background rounded-t-3xl sm:rounded-3xl p-5 pb-7 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[17px] font-bold">{nickname}님과의 거래는 어땠나요?</h2>
          <button onClick={onClose} aria-label="닫기" className="p-1 -m-1 text-muted-foreground shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5">
          <ShieldCheck className="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <p className="text-[12.5px] text-muted-foreground">익명 리뷰입니다</p>
        </div>

        {/* 같은 사람과 또 거래했을 때 — 평가는 사람당 하나라 쌓이지 않고 덮인다.
            이 말이 없으면 새 평가가 추가되는 줄 알고 점수를 두 번 매기려 든다. */}
        {hasReviewed && (
          <div className="mt-2 flex items-start gap-2 rounded-xl bg-primary/10 px-3 py-2.5">
            <RefreshCw className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              이전에 거래했던 이웃입니다. 아래에 남긴 별점으로 평가가 수정됩니다.
            </p>
          </div>
        )}

        {loading ? (
          <p className="text-[13px] text-muted-foreground py-10 text-center">불러오는 중…</p>
        ) : !canReview ? (
          // 거래 기록이 없으면 평가 자체를 못 연다. 서버도 막지만 화면에서 먼저 알린다.
          <p className="text-[13px] text-muted-foreground py-10 text-center leading-relaxed">
            거래를 마친 상대만 평가할 수 있어요.
          </p>
        ) : (
          <>
            <div className="mt-4 space-y-4">
              {questions.map((q, i) => (
                <div key={q} className="rounded-2xl border border-border px-3.5 py-3">
                  <p className="text-[14px] font-medium leading-snug">{q}</p>
                  <StarRating
                    value={answers[i]}
                    size={30}
                    className="mt-2.5 justify-center gap-1.5"
                    onChange={(v) =>
                      setAnswers((prev) => {
                        const next = [...prev] as [number, number, number];
                        next[i] = v;
                        return next;
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <Button
              className="w-full mt-5 h-11 rounded-xl"
              disabled={!allAnswered || saving}
              onClick={handleSave}
            >
              {saving ? '저장 중…' : hasReviewed ? '평가 수정하기' : '평가 남기기'}
            </Button>
            {!allAnswered && (
              <p className="text-[12px] text-muted-foreground text-center mt-2">
                세 항목 모두 별점을 눌러주세요
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
