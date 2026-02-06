import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useChat, Conversation } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ConversationList } from './ConversationList';
import { ChatView } from './ChatView';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUserId?: string | null;
  initialBookId?: string | null;
  initialBookMode?: 'rent' | 'sell' | null;
  initialConversationId?: string | null;
  onResetInitialValues?: () => void;
}

export const ChatModal = ({ 
  isOpen, 
  onClose, 
  initialUserId, 
  initialBookId, 
  initialBookMode,
  initialConversationId, 
  onResetInitialValues 
}: ChatModalProps) => {
  const { user } = useAuth();
  const { conversations, loading, startConversationWithRequest, refresh } = useChat();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [showBookCard, setShowBookCard] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedConversation(null);
      setHasAutoStarted(false);
      setShowBookCard(false);
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

  // Auto-start conversation if initialUserId is provided (with request message)
  useEffect(() => {
    const startChat = async () => {
      if (isOpen && initialUserId && initialBookId && initialBookMode && !initialConversationId && !hasAutoStarted && user) {
        setHasAutoStarted(true);
        setShowBookCard(true);
        
        // Get requester's nickname from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', user.id)
          .single();
        
        // Get book info
        const { data: bookData } = await supabase
          .from('books')
          .select('title, author')
          .eq('id', initialBookId)
          .single();
        
        const requesterNickname = profile?.nickname || '사용자';
        const bookTitle = bookData?.title || '책';
        const bookAuthor = bookData?.author;
        
        // Start conversation with automatic request message including book info
        const { conversation } = await startConversationWithRequest(
          initialUserId, 
          initialBookId, 
          initialBookMode === 'rent' ? 'rent' : 'purchase',
          requesterNickname,
          bookTitle,
          bookAuthor
        );
        
        if (conversation) {
          await refresh();
        }
      }
    };
    
    startChat();
  }, [isOpen, initialUserId, initialBookId, initialBookMode, initialConversationId, hasAutoStarted, user]);

  // Find and select conversation after refresh
  useEffect(() => {
    if (initialUserId && !initialConversationId && conversations.length > 0 && !selectedConversation && hasAutoStarted) {
      const found = conversations.find(c => 
        (c.participant_1 === initialUserId || c.participant_2 === initialUserId) &&
        c.book_id === initialBookId
      );
      if (found) setSelectedConversation(found);
    }
  }, [conversations, initialUserId, initialBookId, initialConversationId, selectedConversation, hasAutoStarted]);

  const handleBack = () => {
    setSelectedConversation(null);
    setHasAutoStarted(false);
    setShowBookCard(false);
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
        key="chat-backdrop"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      >
        <motion.div
          key="chat-modal"
          className="w-[calc(100%-2rem)] max-w-md h-fit box-border"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="bg-card rounded-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl box-border">
          {selectedConversation ? (
            <ChatView conversation={selectedConversation} onBack={handleBack} showBookCard={showBookCard} />
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
      </motion.div>
    </AnimatePresence>
  );
};
