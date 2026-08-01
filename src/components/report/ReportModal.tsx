import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      {/* 다른 모달(책상세·멤버프로필) 안에서 열릴 때, 내부 클릭이 '바깥 클릭'으로 오인돼
          모달이 닫히던 문제 방지 — 취소/신고 버튼으로만 닫는다. */}
      <DialogContent
        className="max-w-sm rounded-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-destructive" />
            {TARGET_LABELS[targetType]} 신고
          </DialogTitle>
          <DialogDescription>
            {targetLabel ? (
              <span className="line-clamp-2">"{targetLabel}"</span>
            ) : (
              '부적절한 콘텐츠를 신고해주세요.'
            )}
          </DialogDescription>
        </DialogHeader>

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
          className="rounded-xl resize-none"
        />

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose} className="rounded-full">
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-full"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : '신고하기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
