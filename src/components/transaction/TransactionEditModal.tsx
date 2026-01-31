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
import { Transaction } from '@/hooks/useTransactions';
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
  const [status, setStatus] = useState<'pending' | 'active' | 'completed'>('active');
  const [transactionType, setTransactionType] = useState<'rent' | 'purchase'>('rent');
  const [returnDate, setReturnDate] = useState('');
  const [saving, setSaving] = useState(false);

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

  const handleComplete = async () => {
    setSaving(true);
    try {
      await onSave(transaction.id, {
        status: 'completed',
      });
      toast.success('반납이 완료되었습니다');
      onClose();
    } catch (error) {
      toast.error('업데이트에 실패했습니다');
    } finally {
      setSaving(false);
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
                onClick={handleComplete}
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
    </AnimatePresence>
  );
};
