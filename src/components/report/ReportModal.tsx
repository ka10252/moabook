import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useReports, REPORT_REASONS, ReportTargetType } from '@/hooks/useReports';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId?: string | null;
  reportedUserId?: string | null;
  /** 신고 대상을 사람이 알아볼 수 있게 (예: 책 제목, 메시지 내용) */
  targetLabel?: string;
  /** 원본이 삭제돼도 관리자가 판단할 수 있도록 남기는 스냅샷 */
  context?: string;
}

const TARGET_LABELS: Record<ReportTargetType, string> = {
  book: '이 책',
  message: '이 메시지',
  post: '이 게시글',
  comment: '이 댓글',
  user: '이 사용자',
};

/**
 * 신고 모달 — 커스텀 오버레이(Radix Dialog 아님).
 * 다른 모달(책상세 Sheet·멤버프로필) 안에서 열릴 때 Radix dismiss가 꼬여
 * 내부 클릭(사유 선택 등)에도 닫히던 문제 때문에 커스텀 모달로 구현한다.
 * 배경 클릭·취소·X 로만 닫히고, 내부 클릭은 stopPropagation.
 */
export const ReportModal = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  reportedUserId,
  targetLabel,
  context,
}: ReportModalProps) => {
  const { submitReport, submitting } = useReports();
  const [reason, setReason] = useState<string>('');
  const [detail, setDetail] = useState('');

  const handleClose = () => {
    setReason('');
    setDetail('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason) {
      toast.error('신고 사유를 선택해주세요');
      return;
    }
    const { error } = await submitReport({
      targetType,
      targetId,
      reportedUserId,
      reason,
      detail,
      context: context ?? targetLabel,
    });
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('신고가 접수되었습니다. 검토 후 조치하겠습니다.');
    handleClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="w-full max-w-sm max-h-[85vh] overflow-y-auto bg-card rounded-2xl shadow-2xl p-5"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <h2 className="flex items-center gap-2 font-display text-[19px] font-medium text-foreground">
                <Flag className="w-4 h-4 text-destructive" />
                {TARGET_LABELS[targetType]} 신고
              </h2>
              <button onClick={handleClose} className="p-1 rounded-lg hover:bg-muted -mr-1">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {targetLabel ? <span className="line-clamp-2">"{targetLabel}"</span> : '부적절한 콘텐츠를 신고해주세요.'}
            </p>

            <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
              {REPORT_REASONS.map((r) => (
                <div key={r.value} className="flex items-center gap-2">
                  <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
                  <Label htmlFor={`reason-${r.value}`} className="text-sm font-normal cursor-pointer">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <Textarea
              placeholder="상세 내용 (선택)"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={500}
              rows={3}
              className="rounded-xl resize-none mt-3"
            />

            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={handleClose} className="flex-1 rounded-full">
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-full"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : '신고하기'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
