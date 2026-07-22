import { useState, useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';
import { ArrowLeft } from 'lucide-react';
import { useChat, Conversation } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ConversationList } from './ConversationList';
import { ChatView } from './ChatView';
import { BookMode } from '@/lib/bookMode';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUserId?: string | null;
  initialBookId?: string | null;
  initialBookMode?: BookMode | null;
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
  /** 이 열림(session) 동안 요청을 이미 보냈는지. state와 달리 즉시 반영되므로 이중 발송을 막는다. */
  const requestSentRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedConversation(null);
      setHasAutoStarted(false);
      setShowBookCard(false);
      requestSentRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialConversationId && conversations.length > 0 && !hasAutoStarted) {
      const found = conversations.find(c => c.id === initialConversationId);
      if (found) { setSelectedConversation(found); setHasAutoStarted(true); }
    }
  }, [isOpen, initialConversationId, conversations, hasAutoStarted]);

  // Navigate to existing conversation by sender userId (e.g. from notification click)
  useEffect(() => {
    if (
      isOpen && initialUserId && !initialBookId && !initialConversationId &&
      conversations.length > 0 && !hasAutoStarted
    ) {
      const found = conversations.find(
        c => c.participant_1 === initialUserId || c.participant_2 === initialUserId
      );
      if (found) { setSelectedConversation(found); setHasAutoStarted(true); }
    }
  }, [isOpen, initialUserId, initialBookId, initialConversationId, conversations, hasAutoStarted]);

  useEffect(() => {
    const startChat = async () => {
      if (
        isOpen && initialUserId && initialBookId && initialBookMode &&
        !initialConversationId && !hasAutoStarted && user &&
        // hasAutoStarted(state)는 다음 렌더에서야 true가 된다. StrictMode가 이 effect를
        // 두 번 실행하면 두 번 다 false로 읽고 문지기를 통과해서, 요청이 두 번 나간다.
        // ref는 즉시 바뀌므로 두 번째 실행을 확실히 막는다.
        !requestSentRef.current
      ) {
        requestSentRef.current = true;
        setHasAutoStarted(true);
        setShowBookCard(true);
        const { data: profile } = await supabase.from('profiles').select('nickname').eq('id', user.id).single();
        const requesterNickname = profile?.nickname || '사용자';
        const { conversation } = await startConversationWithRequest(
          initialUserId, initialBookId,
          initialBookMode,
          requesterNickname
        );
        if (conversation) {
          // 거래 퍼널의 핵심 전환점 — book_viewed 대비 몇 %가 여기까지 오는지가 수요의 실체다
          track('request_sent', { book_id: initialBookId, mode: initialBookMode });
          await refresh();
        }
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
    requestSentRef.current = false;
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
