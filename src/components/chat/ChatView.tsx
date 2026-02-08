import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMessages, Conversation } from '@/hooks/useChat';
import { useTransactions } from '@/hooks/useTransactions';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isYesterday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AcceptRentalModal } from './AcceptRentalModal';
import { ReturnConfirmModal } from './ReturnConfirmModal';
import { RentalMessageCard, RentalMessageType, TransactionType } from './RentalMessageCard';
import { toast } from 'sonner';

interface BookInfo {
  id: string;
  title: string;
  author?: string;
  cover_url: string | null;
}

interface ChatViewProps {
  conversation: Conversation;
  onBack: () => void;
  showBookCard?: boolean;
}

// Message type detection
type MessageCategory = 'request' | 'accepted' | 'returned' | 'regular';

interface ParsedMessage {
  category: MessageCategory;
  transactionType: TransactionType;
  bookId: string | null;
  displayText: string;
}

export const ChatView = ({ conversation, onBack }: ChatViewProps) => {
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useMessages(conversation.id);
  const { createTransaction, transactions, updateTransaction, refresh: refreshTransactions } = useTransactions();
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [acceptRequestType, setAcceptRequestType] = useState<TransactionType>('rent');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<{
    id: string;
    startDate?: string | null;
    returnDate?: string | null;
  } | null>(null);
  const [bookInfoCache, setBookInfoCache] = useState<Record<string, BookInfo>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Extract book ID from message content
  const extractBookId = (content: string): string | null => {
    const match = content.match(/\[BOOK_ID:([^\]]+)\]/);
    return match ? match[1] : null;
  };

  // Parse message to determine category and extract info
  const parseMessage = (content: string): ParsedMessage => {
    const bookId = extractBookId(content);
    const cleanContent = content.replace(/\s*\[BOOK_ID:[^\]]+\]/, '');
    
    // Check for request messages
    if (content.startsWith('[대여 요청]')) {
      return {
        category: 'request',
        transactionType: 'rent',
        bookId,
        displayText: cleanContent.replace(/^\[대여 요청\]\s*/, ''),
      };
    }
    if (content.startsWith('[구매 요청]')) {
      return {
        category: 'request',
        transactionType: 'purchase',
        bookId,
        displayText: cleanContent.replace(/^\[구매 요청\]\s*/, ''),
      };
    }
    
    // Check for acceptance messages
    if (content.startsWith('[대여 수락]')) {
      return {
        category: 'accepted',
        transactionType: 'rent',
        bookId,
        displayText: cleanContent,
      };
    }
    if (content.startsWith('[판매 완료]')) {
      return {
        category: 'accepted',
        transactionType: 'purchase',
        bookId,
        displayText: cleanContent,
      };
    }
    
    // Check for return messages
    if (content.startsWith('[반납 완료]')) {
      return {
        category: 'returned',
        transactionType: 'rent',
        bookId,
        displayText: cleanContent,
      };
    }
    
    return {
      category: 'regular',
      transactionType: 'rent',
      bookId: null,
      displayText: content,
    };
  };

  // Fetch book info for messages that contain book IDs
  useEffect(() => {
    const bookIdsToFetch = new Set<string>();
    
    messages.forEach(msg => {
      const bookId = extractBookId(msg.content);
      if (bookId && !bookInfoCache[bookId]) {
        bookIdsToFetch.add(bookId);
      }
    });
    
    if (bookIdsToFetch.size === 0) return;
    
    const fetchBookInfo = async () => {
      const { data } = await supabase
        .from('books')
        .select('id, title, author, cover_url')
        .in('id', Array.from(bookIdsToFetch));
      
      if (data) {
        const newCache = { ...bookInfoCache };
        data.forEach(book => {
          newCache[book.id] = book;
        });
        setBookInfoCache(newCache);
      }
    };
    
    fetchBookInfo();
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    await sendMessage(newMessage);
    setNewMessage('');
    setSending(false);
  };

  // Find active transaction for a specific book
  const findActiveTransaction = (bookId: string) => {
    return transactions.find(t => t.book_id === bookId && t.status === 'active');
  };

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBack} 
          className="shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground truncate">
            {conversation.other_user?.nickname}
          </h2>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">아직 메시지가 없습니다</p>
            <p className="text-muted-foreground/70 text-xs mt-1">인사를 건네보세요! 👋</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwn = msg.sender_id === user?.id;
            const showDate = index === 0 || 
              new Date(msg.created_at).toDateString() !== 
              new Date(messages[index - 1].created_at).toDateString();
            
            const parsed = parseMessage(msg.content);
            const isSpecialMessage = parsed.category !== 'regular';
            const bookInfo = parsed.bookId ? bookInfoCache[parsed.bookId] : null;
            
            // Find transaction for this book
            const activeTransaction = parsed.bookId ? findActiveTransaction(parsed.bookId) : null;
            
            // Determine if current user can take action
            // For request: owner (not the sender) can accept
            const isBookOwner = bookInfo && msg.sender_id !== user?.id;
            const canAccept = parsed.category === 'request' && isBookOwner && !activeTransaction;
            
            // For accepted: owner (who sent the accept message) can confirm return
            const canShowReturnButton = parsed.category === 'accepted' && 
              parsed.transactionType === 'rent' &&
              activeTransaction && 
              activeTransaction.isMine && 
              isOwn;

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="text-center my-4">
                    <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                      {isToday(new Date(msg.created_at)) 
                        ? '오늘' 
                        : isYesterday(new Date(msg.created_at))
                        ? '어제'
                        : format(new Date(msg.created_at), 'yyyy년 M월 d일', { locale: ko })}
                    </span>
                  </div>
                )}
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} w-full`}
                >
                  <div className={`max-w-[85%] min-w-0 ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    {/* Special Card Messages */}
                    {isSpecialMessage && bookInfo && (
                      <div className="w-full">
                        <RentalMessageCard
                          type={parsed.category as RentalMessageType}
                          transactionType={parsed.transactionType}
                          book={{
                            title: bookInfo.title,
                            author: bookInfo.author || '',
                            cover_url: bookInfo.cover_url,
                          }}
                          startDate={activeTransaction?.start_date}
                          returnDate={activeTransaction?.return_date}
                          showAcceptButton={canAccept}
                          hasActiveTransaction={!!activeTransaction && parsed.category === 'request'}
                          onAcceptClick={() => {
                            if (bookInfo) {
                              setSelectedBookId(bookInfo.id);
                              setAcceptRequestType(parsed.transactionType);
                              setShowAcceptModal(true);
                            }
                          }}
                          showReturnButton={canShowReturnButton}
                          onReturnClick={() => {
                            if (activeTransaction && bookInfo) {
                              setSelectedBookId(bookInfo.id);
                              setSelectedTransaction({
                                id: activeTransaction.id,
                                startDate: activeTransaction.start_date,
                                returnDate: activeTransaction.return_date,
                              });
                              setShowReturnModal(true);
                            }
                          }}
                        />
                        {/* Timestamp for card messages */}
                        <p className={`text-xs mt-1 ${isOwn ? 'text-right' : 'text-left'} text-muted-foreground`}>
                          {format(new Date(msg.created_at), 'a h:mm', { locale: ko })}
                        </p>
                      </div>
                    )}
                    
                    {/* Regular Message Bubble */}
                    {!isSpecialMessage && (
                      <div
                        className={`px-4 py-2.5 rounded-2xl max-w-full ${
                          isOwn
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {parsed.displayText}
                        </p>
                        <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {format(new Date(msg.created_at), 'a h:mm', { locale: ko })}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-border bg-card shrink-0">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="메시지를 입력하세요..."
            className="flex-1 bg-muted border-0"
            maxLength={1000}
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>

      {/* Accept Rental Modal */}
      {selectedBookId && bookInfoCache[selectedBookId] && conversation.other_user && (
        <AcceptRentalModal
          isOpen={showAcceptModal}
          onClose={() => {
            setShowAcceptModal(false);
            setSelectedBookId(null);
          }}
          book={{
            id: selectedBookId,
            title: bookInfoCache[selectedBookId].title,
            author: bookInfoCache[selectedBookId].author || '',
            cover_url: bookInfoCache[selectedBookId].cover_url,
          }}
          borrower={{
            id: conversation.other_user.id,
            nickname: conversation.other_user.nickname,
          }}
          requestType={acceptRequestType}
          onAccept={async (startDate, returnDate) => {
            try {
              await createTransaction(
                selectedBookId!,
                user!.id,
                conversation.other_user!.id,
                acceptRequestType,
                returnDate
              );
              
              // Send confirmation message with book ID
              const startDateStr = startDate 
                ? format(new Date(startDate), 'yyyy년 M월 d일', { locale: ko })
                : format(new Date(), 'yyyy년 M월 d일', { locale: ko });
              
              let confirmMessage: string;
              if (acceptRequestType === 'rent') {
                const returnDateStr = returnDate 
                  ? format(new Date(returnDate), 'yyyy년 M월 d일', { locale: ko })
                  : '미정';
                confirmMessage = `[대여 수락] 책: ${bookInfoCache[selectedBookId!].title} | 대여일: ${startDateStr} | 반납예정일: ${returnDateStr} [BOOK_ID:${selectedBookId}]`;
              } else {
                confirmMessage = `[판매 완료] 책: ${bookInfoCache[selectedBookId!].title} | 거래일: ${startDateStr} [BOOK_ID:${selectedBookId}]`;
              }
              await sendMessage(confirmMessage);
              
              await refreshTransactions();
              
              toast.success(
                acceptRequestType === 'rent' 
                  ? '대여가 수락되었습니다!' 
                  : '판매가 완료되었습니다!'
              );
            } catch (error) {
              console.error('Transaction failed:', error);
              toast.error('처리에 실패했습니다. 다시 시도해주세요.');
              throw error;
            }
          }}
        />
      )}

      {/* Return Confirm Modal */}
      {selectedBookId && bookInfoCache[selectedBookId] && conversation.other_user && selectedTransaction && (
        <ReturnConfirmModal
          isOpen={showReturnModal}
          onClose={() => {
            setShowReturnModal(false);
            setSelectedTransaction(null);
            setSelectedBookId(null);
          }}
          book={{
            id: selectedBookId,
            title: bookInfoCache[selectedBookId].title,
            author: bookInfoCache[selectedBookId].author || '',
            cover_url: bookInfoCache[selectedBookId].cover_url,
          }}
          borrower={{
            id: conversation.other_user.id,
            nickname: conversation.other_user.nickname,
          }}
          startDate={selectedTransaction.startDate}
          returnDate={selectedTransaction.returnDate}
          onConfirmReturn={async () => {
            try {
              await updateTransaction(selectedTransaction.id, { status: 'completed' });
              
              // Send return completion message with book ID
              const returnMessage = `[반납 완료] "${bookInfoCache[selectedBookId!].title}" 반납이 완료되었습니다. [BOOK_ID:${selectedBookId}]`;
              await sendMessage(returnMessage);
              
              await refreshTransactions();
              
              toast.success('반납이 완료되었습니다!');
            } catch (error) {
              console.error('Return failed:', error);
              toast.error('처리에 실패했습니다. 다시 시도해주세요.');
              throw error;
            }
          }}
        />
      )}
    </div>
  );
};
