import { StarRating } from './StarRating';
import type { MannerSummary as Summary } from '@/hooks/useMannerReview';

interface Props {
  summary: Summary | null;
  loading?: boolean;
  /** 내 프로필을 보는 중이면 아예 그리지 않는다 */
  isSelf?: boolean;
}

/**
 * 거래 상대들이 남긴 매너 평가 요약.
 *
 * 2개 미만이면 서버가 개수까지 0으로 눌러 보낸다. 그래서 여기서는
 * "숨긴다"는 판단을 하지 않고, 받은 게 없으면 안내 문구만 띄운다.
 * 화면에서 걸러도 응답에는 값이 실려 있으면 개발자도구로 다 보인다.
 */
export function MannerSummary({ summary, loading, isSelf }: Props) {
  if (isSelf) return null;

  const rows: Array<{ label: string; value: number }> = [];
  if (summary) {
    if (summary.avgPromise !== null) rows.push({ label: '약속한 시간과 장소', value: summary.avgPromise });
    if (summary.avgAsDescribed !== null) rows.push({ label: '책 상태가 설명 그대로', value: summary.avgAsDescribed });
    if (summary.avgBookCare !== null) rows.push({ label: '책을 깨끗하게 사용', value: summary.avgBookCare });
    if (summary.avgRevisit !== null) rows.push({ label: '다시 거래하고 싶음', value: summary.avgRevisit });
  }

  const hasData = !!summary && summary.total >= 2 && summary.avgOverall !== null;

  return (
    <div className="rounded-2xl border border-border p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold">거래 매너</p>
        {hasData && (
          <span className="text-[13px] text-muted-foreground">평가 {summary!.total}개</span>
        )}
      </div>

      {loading ? (
        <p className="text-[13px] text-muted-foreground mt-2">불러오는 중…</p>
      ) : !hasData ? (
        <p className="text-[13px] text-muted-foreground mt-2">
          거래 리뷰가 더 쌓이면 확인 가능합니다
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[22px] font-bold leading-none">{summary!.avgOverall!.toFixed(1)}</span>
            <StarRating value={summary!.avgOverall!} size={16} />
          </div>
          <div className="mt-3 space-y-1.5">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-muted-foreground">{r.label}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StarRating value={r.value} size={12} />
                  <span className="text-[13px] tabular-nums text-muted-foreground w-6 text-right">
                    {r.value.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
