import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Loader2, Book as BookIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
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

interface AcceptRentalModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: {
    id: string;
    title: string;
    author: string;
    cover_url?: string | null;
  };
  borrower: {
    id: string;
    nickname: string;
  };
  /** 책의 실제 거래 유형 — 나눔(give)을 '판매'로 뭉개지 않도록 3분기로 받는다. */
  mode: 'rent' | 'sell' | 'give';
  onAccept: (startDate: string, returnDate?: string) => Promise<void>;
}

export const AcceptRentalModal = ({
  isOpen,
  onClose,
  book,
  borrower,
  mode,
  onAccept,
}: AcceptRentalModalProps) => {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [returnDate, setReturnDate] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      await onAccept(startDate, returnDate || undefined);
      onClose();
    } catch (error) {
      console.error('Failed to accept:', error);
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  const isRent = mode === 'rent';
  const actionLabel = mode === 'rent' ? '대여' : mode === 'give' ? '나눔' : '판매';
  const buttonLabel = `${actionLabel} 수락`;
  const partnerLabel = mode === 'rent' ? '대여자' : mode === 'give' ? '받는 분' : '구매자';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="accept-rental-backdrop"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Modal */}
          <motion.div
            key="accept-rental-modal"
            className="w-[calc(100%-2rem)] max-w-md h-fit box-border"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card rounded-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-display text-[20px] font-medium tracking-tight text-foreground">{buttonLabel}</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4 overflow-y-auto min-h-0">
                {/* Book Info */}
                <div className="bg-muted/50 rounded-xl p-3 flex gap-3">
                  {book.cover_url ? (
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      className="w-14 h-20 object-cover rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                      <BookIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground line-clamp-2">{book.title}</p>
                    <p className="text-sm text-muted-foreground">{book.author}</p>
                  </div>
                </div>

                {/* Borrower Info */}
                <div className="bg-primary/10 rounded-xl p-3">
                  <p className="text-sm text-muted-foreground">
                    {partnerLabel}
                  </p>
                  <p className="font-semibold text-foreground">{borrower.nickname}</p>
                </div>

                {/* Date Inputs */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {isRent ? '대여 시작일' : '거래일'}
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-muted border-0 rounded-xl"
                    />
                  </div>

                  {isRent && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        반납 예정일 (선택)
                      </label>
                      <Input
                        type="date"
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        min={startDate}
                        placeholder="미정"
                        className="bg-muted border-0 rounded-xl"
                      />
                      {!returnDate && (
                        <p className="text-xs text-muted-foreground">
                          반납일을 지정하지 않으면 "미정"으로 설정됩니다
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button
                  onClick={() => setShowConfirm(true)}
                  className="w-full h-12 rounded-xl font-semibold"
                  disabled={!startDate}
                >
                  {buttonLabel}
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Confirmation Dialog */}
          <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
            <AlertDialogContent className="rounded-2xl max-w-[90vw] md:max-w-md z-[70] max-h-[90vh] overflow-y-auto">
              <AlertDialogHeader>
                <AlertDialogTitle>{actionLabel}을(를) 수락하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{book.title}"을(를) {borrower.nickname}님에게 {actionLabel}합니다.
                  {isRent && returnDate && (
                    <>
                      <br />
                      반납 예정일: {format(new Date(returnDate), 'yyyy년 M월 d일', { locale: ko })}
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={submitting} className="rounded-xl">
                  취소
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleAccept}
                  disabled={submitting}
                  className="rounded-xl"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      처리 중...
                    </>
                  ) : (
                    '수락'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
