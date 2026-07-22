import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type ReportTargetType = 'book' | 'message' | 'post' | 'comment' | 'user';
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

/** 신고 사유 — 스토어 심사에서 요구하는 "부적절한 콘텐츠" 범주를 덮는다. */
export const REPORT_REASONS = [
  { value: 'spam', label: '스팸·광고' },
  { value: 'inappropriate', label: '부적절한 콘텐츠 (음란·폭력)' },
  { value: 'harassment', label: '욕설·괴롭힘' },
  { value: 'fraud', label: '사기·허위 거래' },
  { value: 'copyright', label: '저작권 침해' },
  { value: 'other', label: '기타' },
] as const;

export interface ReportInput {
  targetType: ReportTargetType;
  targetId?: string | null;
  reportedUserId?: string | null;
  reason: string;
  detail?: string;
  /** 신고 시점 콘텐츠 스냅샷. 원본이 지워져도 관리자가 판단할 수 있게 남긴다. */
  context?: string;
}

export const useReports = () => {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const submitReport = useCallback(
    async (input: ReportInput): Promise<{ error: string | null }> => {
      if (!user) return { error: '로그인이 필요합니다' };

      setSubmitting(true);
      try {
        const { error } = await supabase.from('reports').insert({
          reporter_id: user.id,
          reported_user_id: input.reportedUserId ?? null,
          target_type: input.targetType,
          target_id: input.targetId ?? null,
          reason: input.reason,
          detail: input.detail?.trim() || null,
          context: input.context?.slice(0, 2000) || null,
        });

        if (error) {
          // 부분 고유 인덱스 위반 = 이미 신고한 대상
          if (error.code === '23505') {
            return { error: '이미 신고한 대상입니다' };
          }
          return { error: error.message };
        }
        return { error: null };
      } finally {
        setSubmitting(false);
      }
    },
    [user?.id]
  );

  return { submitReport, submitting };
};
