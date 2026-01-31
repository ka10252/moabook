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
  requestType: 'rent' | 'purchase';
  onAccept: (startDate: string, returnDate?: string) => Promise<void>;
}

export const AcceptRentalModal = ({
  isOpen,
  onClose,
  book,
  borrower,
  requestType,
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

  const actionLabel = requestType === 'rent' ? '대여' : '판매';
  const buttonLabel = requestType === 'rent' ? '대여 수락' : '판매 수락';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-x-4 top-4 bottom-4 md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 z-[60]"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="bg-card rounded-2xl shadow-xl overflow-hidden max-h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-bold text-foreground">{buttonLabel}</h2>
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
                    {requestType === 'rent' ? '대여자' : '구매자'}
                  </p>
                  <p className="font-semibold text-foreground">{borrower.nickname}</p>
                </div>

                {/* Date Inputs */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {requestType === 'rent' ? '대여 시작일' : '거래일'}
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-muted border-0 rounded-xl"
                    />
                  </div>

                  {requestType === 'rent' && (
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
                  {requestType === 'rent' && returnDate && (
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
        </>
      )}
    </AnimatePresence>
  );
};
