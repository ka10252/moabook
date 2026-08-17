import { useState, useEffect } from 'react';
import { useBackClose } from '@/hooks/useBackClose';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Transaction } from '@/hooks/useTransactions';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { handleReturnCompletion } from '@/utils/transactionHelpers';
import { toast } from 'sonner';

import { ReturnReviewPrompt } from '@/components/review/ReturnReviewPrompt';

interface TransactionEditModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onSave: (id: string, updates: {
    status?: 'pending' | 'active' | 'completed' | 'cancelled';
    type?: 'rent' | 'purchase';
    return_date?: string | null;
  }) => Promise<void>;
}

export const TransactionEditModal = ({
  transaction,
  onClose,
  onSave,
}: TransactionEditModalProps) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<'pending' | 'active' | 'completed'>('active');
  const [transactionType, setTransactionType] = useState<'rent' | 'purchase'>('rent');
  const [returnDate, setReturnDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  // 오버레이는 뒤로가기로 닫힌다. 안 그러면 모달을 둔 채 뒤 페이지만 넘어간다.
  useBackClose(!!transaction, onClose);

  useEffect(() => {
    if (transaction) {
      setStatus(transaction.status as 'pending' | 'active' | 'completed');
      setTransactionType(transaction.type);
      setReturnDate(transaction.return_date 
        ? new Date(transaction.return_date).toISOString().split('T')[0] 
        : ''
      );
    }
  }, [transaction]);

  if (!transaction) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(transaction.id, {
        status,
        type: transactionType,
        return_date: returnDate ? new Date(returnDate).toISOString() : null,
      });
      toast.success('거래 정보가 업데이트되었습니다');
      onClose();
    } catch (error) {
      toast.error('업데이트에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const sendReturnCompleteMessage = async () => {
    if (!user || !transaction.book_id) return;

    // Find conversation for this book between owner and borrower
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant_1.eq.${transaction.owner_id},participant_2.eq.${transaction.borrower_id}),and(participant_1.eq.${transaction.borrower_id},participant_2.eq.${transaction.owner_id})`)
      .maybeSingle();

    if (conversation) {
      await handleReturnCompletion({
        transactionId: transaction.id,
        book: {
          id: transaction.book_id,
          title: transaction.book?.title || '',
          author: transaction.book?.author || '',
          cover_url: transaction.book?.cover_url || null,
        },
        conversationId: conversation.id,
        userId: user.id,
      });
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      // Send return complete message to chat
      await sendReturnCompleteMessage();

      toast.success('반납이 완료되었습니다');
      // 방금 책을 돌려준 사람에게만 리뷰를 묻는다.
      // 책 주인에게 물으면 자기 책에 별점을 매기는 꼴이 된다.
      // 하루만 지나도 그 책을 다시 찾아 들어오는 사람은 거의 없어서, 지금이 유일한 기회다.
      if (!transaction?.isMine && transaction?.book?.id) {
        setShowReviewPrompt(true);
      } else {
        onClose();
      }
    } catch (error) {
      toast.error('업데이트에 실패했습니다');
    } finally {
      setSaving(false);
      setShowReturnConfirm(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="transaction-edit-backdrop"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          key="transaction-edit-modal"
          className="w-[calc(100%-2rem)] max-w-md h-fit box-border"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-card rounded-2xl overflow-hidden shadow-xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-display text-[20px] font-medium tracking-tight text-foreground">거래 수정</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </header>

          {/* Content — 화면보다 길면 내부 스크롤(팝업이 화면 밖으로 넘치지 않게) */}
          <div className="p-4 space-y-4 flex-1 overflow-y-auto min-h-0">
            {/* Book Info */}
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="font-medium text-foreground">{transaction.book?.title}</p>
              <p className="text-sm text-muted-foreground">{transaction.book?.author}</p>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>거래 유형</Label>
              <Select value={transactionType} onValueChange={(v) => setTransactionType(v as 'rent' | 'purchase')}>
                <SelectTrigger className="bg-muted border-0 rounded-xl h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">대여해줌</SelectItem>
                  <SelectItem value="purchase">판매완료</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Return Date (only for rent) */}
            {transactionType === 'rent' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  반납 예정일
                </Label>
                <Input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="bg-muted border-0 rounded-xl h-12"
                />
                <p className="text-xs text-muted-foreground">
                  설정하지 않으면 '미정'으로 표시됩니다
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-border flex gap-3">
            {transactionType === 'rent' && status === 'active' && (
              <Button
                variant="outline"
                onClick={() => setShowReturnConfirm(true)}
                disabled={saving}
                className="flex-1 h-12 rounded-xl"
              >
                반납 완료
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-12 rounded-xl"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                '저장'
              )}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Return Confirmation Dialog */}
      <AlertDialog open={showReturnConfirm} onOpenChange={setShowReturnConfirm}>
        <AlertDialogContent className="rounded-2xl max-w-[90vw] md:max-w-md z-[70]">
          <AlertDialogHeader>
            <AlertDialogTitle>반납 처리 하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              "{transaction.book?.title}"의 반납을 완료합니다.
              {transaction.counterparty?.nickname}님에게 반납 완료 알림이 전송됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} className="rounded-xl">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleComplete}
              disabled={saving}
              className="rounded-xl"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  처리 중...
                </>
              ) : (
                '반납 완료'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 반납 직후 리뷰 — 건너뛰기도 항상 열어둔다 */}
      {showReviewPrompt && transaction?.book?.id && (
        <ReturnReviewPrompt
          bookId={transaction.book.id}
          bookTitle={transaction.book.title}
          onClose={() => { setShowReviewPrompt(false); onClose(); }}
        />
      )}
    </motion.div>
    </AnimatePresence>
  );
};
