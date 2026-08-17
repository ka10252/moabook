import { X, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BadgeStamp, BADGES, BADGE_META, type BadgeId } from '@/components/BadgeStamp';
import { useBackClose } from '@/hooks/useBackClose';

interface Props {
  id: BadgeId;
  /** 획득했으면 단계(단계 없는 배지는 1), 미획득이면 null */
  tier: number | null;
  onClose: () => void;
  /** 내 프로필에서만 — 대표 배지 지정 */
  onSetFeatured?: () => void;
  isFeatured?: boolean;
}

const condOf = (id: BadgeId) => BADGE_META.find((m) => m.id === id)?.cond ?? '';

export function BadgeDetailSheet({ id, tier, onClose, onSetFeatured, isFeatured }: Props) {
  useBackClose(true, onClose);

  const badge = BADGES[id];
  const earned = tier != null;
  const tiered = badge.tier;
  // 단계 배지는 조건이 "등록 3 / 10 / 30권" 꼴이라 슬래시로 갈라 단계별로 보여준다
  const steps = tiered ? condOf(id).split('/').map((s) => s.trim()) : [];

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-[360px] bg-background rounded-t-3xl sm:rounded-3xl p-5 pb-7">
        <button onClick={onClose} aria-label="닫기" className="absolute top-4 right-4 p-1 text-muted-foreground">
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center pt-2">
          <BadgeStamp id={id} tier={(tier || undefined) as 1 | 2 | 3 | undefined} size={72} muted={!earned} />
          <p className="mt-3 text-[17px] font-bold">{badge.name}</p>
          {tiered && earned && (
            <p className="text-[12px] text-muted-foreground mt-0.5">{tier}단계</p>
          )}
        </div>

        <div className="mt-4 rounded-2xl bg-muted/60 px-3.5 py-3">
          {tiered ? (
            <ul className="space-y-1.5">
              {steps.map((s, i) => (
                <li key={s} className="flex items-center justify-between gap-3">
                  <span className={`text-[13px] ${earned && tier! > i ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {i + 1}단계 · {s}
                  </span>
                  {earned && tier! > i && <span className="text-[12px] text-primary shrink-0">달성</span>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className={`text-[13px] ${earned ? 'text-foreground' : 'text-muted-foreground'}`}>{condOf(id)}</span>
              {earned && <span className="text-[12px] text-primary shrink-0">달성</span>}
            </div>
          )}
        </div>

        {onSetFeatured && earned && (
          <Button
            variant={isFeatured ? 'secondary' : 'outline'}
            className="w-full mt-4 h-10 rounded-xl gap-1.5"
            disabled={isFeatured}
            onClick={() => { onSetFeatured(); onClose(); }}
          >
            <Star className="w-4 h-4" />
            {isFeatured ? '대표 배지' : '대표 배지로'}
          </Button>
        )}
      </div>
    </div>
  );
}
