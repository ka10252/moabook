import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * F3 · 거래 상대 익명 매너 평가.
 *
 * 이 훅은 테이블을 직접 읽지 않는다. 전부 RPC다.
 * 평가 원본에는 누가 줬는지가 들어 있어서, 클라이언트가 한 줄이라도 읽을 수 있으면
 * 익명이 그 순간 깨진다. 서버가 집계만 내보낸다(마이그 20260818000002 참고).
 */

/** 평가받는 사람이 그 거래에서 맡았던 역할 */
export type MannerRole = 'lender' | 'borrower';

export interface MannerSummary {
  total: number;
  avgOverall: number | null;
  avgPromise: number | null;
  avgRevisit: number | null;
  lenderCount: number;
  avgAsDescribed: number | null;
  borrowerCount: number;
  avgBookCare: number | null;
}

export interface MannerAnswers {
  q1: number;
  q2: number;
  q3: number;
}

/** 질문은 2번만 역할에 따라 갈린다 */
export const MANNER_QUESTIONS: Record<MannerRole, [string, string, string]> = {
  lender: [
    '약속한 시간과 장소를 잘 지켰나요?',
    '책 상태가 설명한 그대로였나요?',
    '다음에도 이 사람과 거래하고 싶나요?',
  ],
  borrower: [
    '약속한 시간과 장소를 잘 지켰나요?',
    '책을 깨끗하게 보고 돌려줬나요?',
    '다음에도 이 사람과 거래하고 싶나요?',
  ],
};

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export const useMannerReview = (otherUserId: string | null | undefined) => {
  const [role, setRole] = useState<MannerRole | null>(null);
  const [summary, setSummary] = useState<MannerSummary | null>(null);
  const [myAnswers, setMyAnswers] = useState<MannerAnswers | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!otherUserId) {
      setRole(null);
      setSummary(null);
      setMyAnswers(null);
      return;
    }
    setLoading(true);

    const [roleRes, summaryRes, mineRes] = await Promise.all([
      supabase.rpc('manner_review_role' as never, { p_user: otherUserId } as never),
      supabase.rpc('get_manner_summary' as never, { p_user: otherUserId } as never),
      supabase.rpc('get_my_manner_review' as never, { p_user: otherUserId } as never),
    ]);

    setRole((roleRes.data as MannerRole | null) ?? null);

    // 집계 RPC는 RETURNS TABLE이라 배열로 온다
    const row = (summaryRes.data as unknown as Array<Record<string, unknown>>)?.[0];
    setSummary(
      row
        ? {
            total: Number(row.total ?? 0),
            avgOverall: num(row.avg_overall),
            avgPromise: num(row.avg_promise),
            avgRevisit: num(row.avg_revisit),
            lenderCount: Number(row.lender_count ?? 0),
            avgAsDescribed: num(row.avg_as_described),
            borrowerCount: Number(row.borrower_count ?? 0),
            avgBookCare: num(row.avg_book_care),
          }
        : null,
    );

    const mine = (mineRes.data as unknown as Array<Record<string, unknown>>)?.[0];
    setMyAnswers(mine ? { q1: Number(mine.q1), q2: Number(mine.q2), q3: Number(mine.q3) } : null);

    setLoading(false);
  }, [otherUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (answers: MannerAnswers) => {
      if (!otherUserId) return { error: new Error('상대를 알 수 없습니다') };
      const { error } = await supabase.rpc('submit_manner_review' as never, {
        p_user: otherUserId,
        p_q1: answers.q1,
        p_q2: answers.q2,
        p_q3: answers.q3,
      } as never);
      if (!error) await load();
      return { error };
    },
    [otherUserId, load],
  );

  return {
    /** 평가할 수 있는가 = 끝낸 거래가 있는가. null이면 자격 없음 */
    role,
    canReview: role !== null,
    summary,
    myAnswers,
    hasReviewed: myAnswers !== null,
    loading,
    submit,
    reload: load,
  };
};
