import { useState, useRef, useEffect, useMemo } from 'react';
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
import { BookCardPreview } from '@/components/BookCardPreview';
import { AcceptRentalModal } from './AcceptRentalModal';
import { RentalConfirmationCard } from './RentalConfirmationCard';
import { ReturnConfirmModal } from './ReturnConfirmModal';
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

export const ChatView = ({ conversation, onBack, showBookCard = false }: ChatViewProps) => {
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useMessages(conversation.id);
  const { createTransaction, transactions, updateTransaction, refresh: refreshTransactions } = useTransactions();
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [acceptRequestType, setAcceptRequestType] = useState<'rent' | 'purchase'>('rent');
  const [selectedTransaction, setSelectedTransaction] = useState<{
    id: string;
    startDate?: string | null;
    returnDate?: string | null;
  } | null>(null);
  const [bookInfoCache, setBookInfoCache] = useState<Record<string, BookInfo>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Extract book IDs from request messages
  const extractBookId = (content: string): string | null => {
    const match = content.match(/\[BOOK_ID:([^\]]+)\]/);
    return match ? match[1] : null;
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

  // Find active transaction for this book
  const activeTransaction = conversation.book 
    ? transactions.find(t => t.book_id === conversation.book!.id && t.status === 'active')
    : null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    await sendMessage(newMessage);
    setNewMessage('');
    setSending(false);
  };

  const handleBack = () => {
    onBack();
  };

  // Parse rental/purchase confirmation message
  const parseConfirmationMessage = (content: string) => {
    const rentAcceptMatch = content.match(/^\[대여 수락\] 책: (.+?) \| 대여일: (.+?) \| 반납예정일: (.+)$/);
    const purchaseAcceptMatch = content.match(/^\[판매 완료\] 책: (.+?) \| 거래일: (.+)$/);
    const returnMatch = content.match(/^\[반납 완료\] "(.+?)" 반납이 완료되었습니다\.$/);
    
    if (rentAcceptMatch) {
      return {
        type: 'accepted' as const,
        transactionType: 'rent' as const,
        bookTitle: rentAcceptMatch[1],
        startDate: rentAcceptMatch[2] !== '미정' ? rentAcceptMatch[2] : null,
        returnDate: rentAcceptMatch[3] !== '미정' ? rentAcceptMatch[3] : null,
      };
    }
    if (purchaseAcceptMatch) {
      return {
        type: 'accepted' as const,
        transactionType: 'purchase' as const,
        bookTitle: purchaseAcceptMatch[1],
        startDate: purchaseAcceptMatch[2],
        returnDate: null,
      };
    }
    if (returnMatch) {
      return {
        type: 'returned' as const,
        transactionType: 'rent' as const,
        bookTitle: returnMatch[1],
      };
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleBack} 
          className="shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground truncate">
            {conversation.other_user?.nickname}
          </h2>
          {conversation.book && (
            <p className="text-xs text-muted-foreground truncate">
              관련 책: {conversation.book.title}
            </p>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 min-h-0">
        {/* Book Card Preview at the top if available */}
        {conversation.book && showBookCard && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <BookCardPreview
              title={conversation.book.title}
              author={conversation.book.author || ''}
              coverUrl={conversation.book.cover_url}
            />
          </motion.div>
        )}
        
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
            
            // Check if this is a request message
            const isRentRequest = msg.content.startsWith('[대여 요청]');
            const isPurchaseRequest = msg.content.startsWith('[구매 요청]');
            const isRequestMessage = isRentRequest || isPurchaseRequest;
            
            // Extract book ID from the message for dynamic book info
            const messageBookId = extractBookId(msg.content);
            const messageBookInfo = messageBookId ? bookInfoCache[messageBookId] : null;
            
            // Use message-specific book info, or fall back to conversation book
            const displayBook = messageBookInfo || conversation.book;
            
            // Check if this is a confirmation message
            const confirmationData = parseConfirmationMessage(msg.content);
            const isConfirmationMessage = confirmationData !== null;
            
            // Find transaction for the specific book in this message
            const messageTransaction = messageBookId 
              ? transactions.find(t => t.book_id === messageBookId && t.status === 'active')
              : activeTransaction;
            
            // Book owner can accept - only if they are NOT the sender of the request
            const isBookOwner = displayBook && user?.id !== msg.sender_id;
            const canAccept = isRequestMessage && isBookOwner && !isOwn && !messageTransaction;

            // Check if owner can see return button on accepted messages (only for rent, not purchase)
            const canShowReturnButton = confirmationData?.type === 'accepted' && 
              confirmationData?.transactionType === 'rent' &&
              messageTransaction && 
              messageTransaction.isMine && 
              isOwn; // Owner sent the acceptance message

            // Clean message content for display (remove BOOK_ID tag)
            const cleanMessageContent = (content: string) => {
              return content.replace(/\s*\[BOOK_ID:[^\]]+\]/, '');
            };

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
                  <div className={`max-w-[80%] min-w-0 ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                    {/* Book Card for request messages - use message-specific book info */}
                    {isRequestMessage && displayBook && (
                      <div className="w-full">
                        <BookCardPreview
                          title={displayBook.title}
                          author={displayBook.author || ''}
                          coverUrl={displayBook.cover_url}
                          className="shadow-sm"
                        />
                        {canAccept && (
                          <Button
                            size="sm"
                            className="w-full mt-2 rounded-xl flex-shrink-0"
                            onClick={() => {
                              setAcceptRequestType(isRentRequest ? 'rent' : 'purchase');
                              // Store the book ID from the message for the modal
                              if (messageBookId) {
                                // Update conversation.book temporarily for the modal
                                conversation.book = {
                                  id: messageBookId,
                                  title: displayBook.title,
                                  author: displayBook.author,
                                  cover_url: displayBook.cover_url,
                                };
                              }
                              setShowAcceptModal(true);
                            }}
                          >
                            {isRentRequest ? '대여 수락' : '구매 수락'}
                          </Button>
                        )}
                        {messageTransaction && !canAccept && (
                          <div className="text-center text-xs text-muted-foreground mt-2 py-1 bg-muted rounded-lg">
                            이미 진행 중인 거래가 있습니다
                          </div>
                        )}
                      </div>
                    )}

                    {/* Rental/Purchase Confirmation Card */}
                    {isConfirmationMessage && displayBook && (
                      <div className="w-full">
                        <RentalConfirmationCard
                          type={confirmationData.type}
                          transactionType={confirmationData.transactionType}
                          book={{
                            title: displayBook.title,
                            author: displayBook.author || '',
                            cover_url: displayBook.cover_url,
                          }}
                          startDate={confirmationData.type === 'accepted' ? messageTransaction?.start_date : undefined}
                          returnDate={confirmationData.type === 'accepted' ? messageTransaction?.return_date : undefined}
                          isOwner={canShowReturnButton}
                          showReturnButton={canShowReturnButton}
                          onReturnClick={() => {
                            if (messageTransaction) {
                              setSelectedTransaction({
                                id: messageTransaction.id,
                                startDate: messageTransaction.start_date,
                                returnDate: messageTransaction.return_date,
                              });
                              setShowReturnModal(true);
                            }
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Regular Message Bubble (hide for confirmation messages as they have custom UI) */}
                    {!isConfirmationMessage && (
                      <div
                        className={`px-4 py-2.5 rounded-2xl max-w-full ${
                          isOwn
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {isRequestMessage 
                            ? cleanMessageContent(msg.content).replace(/^\[(대여|구매) 요청\]\s*/, '') 
                            : msg.content
                          }
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
      {conversation.book && conversation.other_user && (
        <AcceptRentalModal
          isOpen={showAcceptModal}
          onClose={() => setShowAcceptModal(false)}
          book={{
            id: conversation.book.id,
            title: conversation.book.title,
            author: conversation.book.author || '',
            cover_url: conversation.book.cover_url,
          }}
          borrower={{
            id: conversation.other_user.id,
            nickname: conversation.other_user.nickname,
          }}
          requestType={acceptRequestType}
          onAccept={async (startDate, returnDate) => {
            try {
              await createTransaction(
                conversation.book!.id,
                user!.id,
                conversation.other_user!.id,
                acceptRequestType,
                returnDate
              );
              
              // Send confirmation message based on type
              const startDateStr = startDate 
                ? format(new Date(startDate), 'yyyy년 M월 d일', { locale: ko })
                : format(new Date(), 'yyyy년 M월 d일', { locale: ko });
              
              let confirmMessage: string;
              if (acceptRequestType === 'rent') {
                const returnDateStr = returnDate 
                  ? format(new Date(returnDate), 'yyyy년 M월 d일', { locale: ko })
                  : '미정';
                confirmMessage = `[대여 수락] 책: ${conversation.book!.title} | 대여일: ${startDateStr} | 반납예정일: ${returnDateStr}`;
              } else {
                confirmMessage = `[판매 완료] 책: ${conversation.book!.title} | 거래일: ${startDateStr}`;
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
      {conversation.book && conversation.other_user && selectedTransaction && (
        <ReturnConfirmModal
          isOpen={showReturnModal}
          onClose={() => {
            setShowReturnModal(false);
            setSelectedTransaction(null);
          }}
          book={{
            id: conversation.book.id,
            title: conversation.book.title,
            author: conversation.book.author || '',
            cover_url: conversation.book.cover_url,
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
              
              // Send return completion message
              const returnMessage = `[반납 완료] "${conversation.book!.title}" 반납이 완료되었습니다.`;
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
