import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
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
  onResetInitialValues,
}: ChatModalProps) => {
  const { user } = useAuth();
  const { conversations, loading, startConversationWithRequest, refresh } = useChat();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [showBookCard, setShowBookCard] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedConversation(null);
      setHasAutoStarted(false);
      setShowBookCard(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialConversationId && conversations.length > 0 && !hasAutoStarted) {
      const found = conversations.find(c => c.id === initialConversationId);
      if (found) { setSelectedConversation(found); setHasAutoStarted(true); }
    }
  }, [isOpen, initialConversationId, conversations, hasAutoStarted]);

  useEffect(() => {
    const startChat = async () => {
      if (isOpen && initialUserId && initialBookId && initialBookMode && !initialConversationId && !hasAutoStarted && user) {
        setHasAutoStarted(true);
        setShowBookCard(true);
        const { data: profile } = await supabase.from('profiles').select('nickname').eq('id', user.id).single();
        const requesterNickname = profile?.nickname || '사용자';
        const { conversation } = await startConversationWithRequest(
          initialUserId, initialBookId,
          initialBookMode === 'rent' ? 'rent' : 'purchase',
          requesterNickname
        );
        if (conversation) await refresh();
      }
    };
    startChat();
  }, [isOpen, initialUserId, initialBookId, initialBookMode, initialConversationId, hasAutoStarted, user]);

  useEffect(() => {
    if (initialUserId && !initialConversationId && conversations.length > 0 && !selectedConversation && hasAutoStarted) {
      const found = conversations.find(c => c.participant_1 === initialUserId || c.participant_2 === initialUserId);
      if (found) setSelectedConversation(found);
    }
  }, [conversations, initialUserId, initialConversationId, selectedConversation, hasAutoStarted]);

  const handleBack = () => {
    setSelectedConversation(null);
    setHasAutoStarted(false);
    setShowBookCard(false);
    onResetInitialValues?.();
    refresh();
  };

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col">
      {selectedConversation ? (
        <ChatView conversation={selectedConversation} onBack={handleBack} showBookCard={showBookCard} />
      ) : (
        <>
          {/* Header */}
          <header className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0 bg-background/80 backdrop-blur-md">
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <h2 className="font-display text-[20px] font-medium tracking-tight text-foreground">메시지</h2>
          </header>

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
  );
};
