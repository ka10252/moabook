import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useChat, Conversation } from '@/hooks/useChat';
import { ConversationList } from './ConversationList';
import { ChatView } from './ChatView';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUserId?: string | null;
  initialBookId?: string | null;
  initialConversationId?: string | null;
  onResetInitialValues?: () => void;
}

export const ChatModal = ({ isOpen, onClose, initialUserId, initialBookId, initialConversationId, onResetInitialValues }: ChatModalProps) => {
  const { conversations, loading, startConversation, refresh } = useChat();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedConversation(null);
      setHasAutoStarted(false);
    }
  }, [isOpen]);

  // Auto-select conversation if initialConversationId is provided
  useEffect(() => {
    if (isOpen && initialConversationId && conversations.length > 0 && !hasAutoStarted) {
      const found = conversations.find(c => c.id === initialConversationId);
      if (found) {
        setSelectedConversation(found);
        setHasAutoStarted(true);
      }
    }
  }, [isOpen, initialConversationId, conversations, hasAutoStarted]);

  // Auto-start conversation if initialUserId is provided
  useEffect(() => {
    if (isOpen && initialUserId && !initialConversationId && !hasAutoStarted) {
      setHasAutoStarted(true);
      startConversation(initialUserId, initialBookId || undefined).then(({ conversation }) => {
        if (conversation) {
          refresh().then(() => {
            const found = conversations.find(c => c.id === conversation.id);
            if (found) setSelectedConversation(found);
          });
        }
      });
    }
  }, [isOpen, initialUserId, initialBookId, initialConversationId, hasAutoStarted]);

  // Find and select conversation after refresh (only once)
  useEffect(() => {
    if (initialUserId && !initialConversationId && conversations.length > 0 && !selectedConversation && hasAutoStarted) {
      const found = conversations.find(c => 
        c.participant_1 === initialUserId || c.participant_2 === initialUserId
      );
      if (found) setSelectedConversation(found);
    }
  }, [conversations, initialUserId, initialConversationId, selectedConversation, hasAutoStarted]);

  const handleBack = () => {
    setSelectedConversation(null);
    setHasAutoStarted(false);
    onResetInitialValues?.();
    refresh();
  };

  const handleClose = () => {
    setSelectedConversation(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      />
      
      <motion.div
        className="fixed inset-x-4 top-[5%] bottom-[10%] md:inset-x-auto md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2 z-50 max-h-[85vh]"
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-card rounded-2xl h-full max-h-[85vh] overflow-hidden flex flex-col shadow-xl">
          {selectedConversation ? (
            <ChatView conversation={selectedConversation} onBack={handleBack} />
          ) : (
            <>
              {/* Header */}
              <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <h2 className="text-lg font-bold text-foreground">메시지</h2>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-xl hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </header>

              {/* Conversations */}
              <div className="flex-1 overflow-y-auto">
                <ConversationList
                  conversations={conversations}
                  loading={loading}
                  selectedId={null}
                  onSelect={setSelectedConversation}
                />
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
