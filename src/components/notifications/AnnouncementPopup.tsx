import { Mail, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface AnnouncementPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnnouncementPopup = ({ isOpen, onClose }: AnnouncementPopupProps) => {
  const { announcement, isLoading, markAsSeen } = useAnnouncement();

  const handleClose = () => {
    markAsSeen();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={handleClose}
          />
          
          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md"
          >
            <div className="bg-card rounded-xl shadow-xl border border-border overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">관리자의 한마디</h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : announcement?.admin_message ? (
                  <div className="space-y-3">
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                      {announcement.admin_message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      마지막 업데이트: {format(new Date(announcement.updated_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    아직 공지사항이 없습니다.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
