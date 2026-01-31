import { useState, useEffect } from 'react';
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
import { toast } from 'sonner';

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
      .eq('book_id', transaction.book_id)
      .or(`and(participant_1.eq.${transaction.owner_id},participant_2.eq.${transaction.borrower_id}),and(participant_1.eq.${transaction.borrower_id},participant_2.eq.${transaction.owner_id})`)
      .maybeSingle();

    if (conversation) {
      const returnMessage = `[반납 완료] "${transaction.book?.title}" 반납이 완료되었습니다.`;
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: returnMessage,
      });

      // Update conversation's last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await onSave(transaction.id, {
        status: 'completed',
      });
      
      // Send return complete message to chat
      await sendReturnCompleteMessage();
      
      toast.success('반납이 완료되었습니다');
      onClose();
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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      
      <motion.div
        className="fixed inset-x-4 top-[15%] md:inset-x-auto md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2 z-[60]"
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-card rounded-2xl overflow-hidden shadow-xl">
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">거래 수정</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </header>

          {/* Content */}
          <div className="p-4 space-y-4">
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
    </AnimatePresence>
  );
};
