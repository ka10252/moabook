import { X, Star, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BadgeStamp, BADGES, metaOf, type BadgeId } from '@/components/BadgeStamp';
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

export function BadgeDetailSheet({ id, tier, onClose, onSetFeatured, isFeatured }: Props) {
  useBackClose(true, onClose);

  const badge = BADGES[id];
  const meta = metaOf(id);
  const earned = tier != null;
  const tiered = badge.tier && meta.tiers.length > 1;

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
            <p className="text-[12px] text-muted-foreground mt-0.5">{tier}단계 / {meta.tiers.length}단계</p>
          )}
        </div>

        {/* 어떻게 하면 받는지 — 조건 숫자만 보여주면 '무엇이 세어지는지'를 알 수 없다 */}
        <p className="mt-4 text-[13.5px] text-foreground leading-relaxed text-center">{meta.how}</p>

        {id !== 'elder' && (
          <div className="mt-4 rounded-2xl bg-muted/60 px-3.5 py-3">
            {tiered ? (
              <ul className="space-y-2">
                {meta.tiers.map((n, i) => {
                  const done = earned && tier! > i;
                  return (
                    <li key={n} className="flex items-center justify-between gap-3">
                      <span className={`text-[13px] ${done ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {i + 1}단계 · {meta.counts} {n}{meta.unit}
                      </span>
                      {done ? (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      ) : (
                        <span className="text-[12px] text-faint shrink-0">아직</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className={`text-[13px] ${earned ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {meta.counts} {meta.tiers[0]}{meta.unit}
                </span>
                {earned ? (
                  <Check className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <span className="text-[12px] text-faint shrink-0">아직</span>
                )}
              </div>
            )}
          </div>
        )}

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
