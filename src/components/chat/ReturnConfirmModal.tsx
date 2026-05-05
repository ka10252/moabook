import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Loader2, Book as BookIcon, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface ReturnConfirmModalProps {
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
  startDate?: string | null;
  returnDate?: string | null;
  onConfirmReturn: () => Promise<void>;
}

export const ReturnConfirmModal = ({
  isOpen,
  onClose,
  book,
  borrower,
  startDate,
  returnDate,
  onConfirmReturn,
}: ReturnConfirmModalProps) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirmReturn();
      onClose();
    } catch (error) {
      console.error('Failed to confirm return:', error);
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="return-confirm-backdrop"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Modal */}
          <motion.div
            key="return-confirm-modal"
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
                <h2 className="font-display text-[20px] font-medium tracking-tight text-foreground">반납 확인</h2>
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
                  <p className="text-sm text-muted-foreground">대여자</p>
                  <p className="font-semibold text-foreground">{borrower.nickname}</p>
                </div>

                {/* Date Info */}
                <div className="space-y-2">
                  {startDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">대여일:</span>
                      <span className="text-foreground font-medium">
                        {format(new Date(startDate), 'yyyy년 M월 d일', { locale: ko })}
                      </span>
                    </div>
                  )}
                  {returnDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">반납 예정일:</span>
                      <span className="text-foreground font-medium">
                        {format(new Date(returnDate), 'yyyy년 M월 d일', { locale: ko })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-muted-foreground">반납일:</span>
                    <span className="text-foreground font-medium">
                      {format(new Date(), 'yyyy년 M월 d일', { locale: ko })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button
                  onClick={() => setShowConfirm(true)}
                  className="w-full h-12 rounded-xl font-semibold bg-green-600 hover:bg-green-700"
                >
                  반납 완료
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Confirmation Dialog */}
          <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
            <AlertDialogContent className="rounded-2xl max-w-[90vw] md:max-w-md z-[70] max-h-[90vh] overflow-y-auto">
              <AlertDialogHeader>
                <AlertDialogTitle>반납 처리 하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{book.title}"의 반납을 완료합니다. 
                  {borrower.nickname}님에게 반납 완료 알림이 전송됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={submitting} className="rounded-xl">
                  취소
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="rounded-xl bg-green-600 hover:bg-green-700"
                >
                  {submitting ? (
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
        </motion.div>
      )}
    </AnimatePresence>
  );
};
