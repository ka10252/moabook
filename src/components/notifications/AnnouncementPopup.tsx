import { Mail, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="announcement-backdrop"
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          {/* Popup */}
          <motion.div
            key="announcement-modal"
            className="w-[calc(100%-2rem)] max-w-sm h-fit box-border"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
              {/* Header */}
              <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-foreground">관리자의 한마디</h3>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </header>

              {/* Content */}
              <ScrollArea className="flex-1 min-h-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : announcement?.admin_message ? (
                  <div className="p-4 space-y-3">
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                      {announcement.admin_message}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      마지막 업데이트: {format(new Date(announcement.updated_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <Mail className="w-12 h-12 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">
                      아직 공지사항이 없습니다
                    </p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
