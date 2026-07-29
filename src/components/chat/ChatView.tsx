import { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Loader2, Plus, Book as BookPickIcon, X, ChevronRight, Camera, ImageIcon } from 'lucide-react';
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
import { TransactionDashboard } from '../transaction/TransactionDashboard';
import { RentalMessageCard, RentalMessageType, TransactionType } from './RentalMessageCard';
import { handleReturnCompletion } from '@/utils/transactionHelpers';
import { toast } from 'sonner';

interface BookInfo {
  id: string;
  title: string;
  author?: string;
  cover_url: string | null;
  status?: 'available' | 'rented' | 'sold';
  mode?: 'rent' | 'sell' | 'give';
}

interface ChatViewProps {
  conversation: Conversation;
  onBack: () => void;
  showBookCard?: boolean;
}

// Message type detection
type MessageCategory = 'request' | 'accepted' | 'returned' | 'return_request' | 'image' | 'regular';

interface ParsedMessage {
  category: MessageCategory;
  transactionType: TransactionType;
  /** 유저에게 보이는 실제 모드. 나눔·판매는 거래상 둘 다 purchase지만 화면 표기는 달라야 한다. */
  mode: 'rent' | 'sell' | 'give';
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
  const [showMore, setShowMore] = useState(false);
  const [showTransactionDashboard, setShowTransactionDashboard] = useState(false);
  const showMoreRef = useRef<HTMLDivElement>(null);
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [otherUserBooks, setOtherUserBooks] = useState<BookInfo[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showAttachSheet, setShowAttachSheet] = useState(false);

  // + 버튼 → 이미지(PayNow·PayLah QR 등) 첨부. book-covers 버킷의 chat/ 경로에 올린다.
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 다시 골라도 onChange가 뜨도록 초기화
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 보낼 수 있어요');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('이미지는 5MB 이하여야 해요');
      return;
    }
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `chat/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('book-covers').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('book-covers').getPublicUrl(path);
      await sendMessage(`[IMAGE:${publicUrl}]`);
    } catch (err) {
      console.error('이미지 전송 실패:', err);
      toast.error('이미지를 보내지 못했어요');
    } finally {
      setUploadingImage(false);
    }
  };

  // Extract book ID from message content
  const extractBookId = (content: string): string | null => {
    const match = content.match(/\[BOOK_ID:([^\]]+)\]/);
    return match ? match[1] : null;
  };

  // Parse message to determine category and extract info
  const parseMessage = (content: string): ParsedMessage => {
    const bookId = extractBookId(content);
    const cleanContent = content.replace(/\s*\[BOOK_ID:[^\]]+\]/, '');

    // 이미지(PayNow·PayLah QR 등) — displayText에 이미지 URL을 담는다
    if (content.startsWith('[IMAGE:')) {
      return {
        category: 'image',
        transactionType: 'rent',
        mode: 'rent',
        bookId: null,
        displayText: content.match(/^\[IMAGE:([^\]]+)\]/)?.[1] ?? '',
      };
    }

    // Check for request messages
    if (content.startsWith('[대여 요청]')) {
      return {
        category: 'request',
        transactionType: 'rent',
        mode: 'rent',
        bookId,
        displayText: cleanContent.replace(/^\[대여 요청\]\s*/, ''),
      };
    }
    if (content.startsWith('[구매 요청]')) {
      return {
        category: 'request',
        transactionType: 'purchase',
        mode: 'sell',
        bookId,
        displayText: cleanContent.replace(/^\[구매 요청\]\s*/, ''),
      };
    }
    // 나눔은 거래 기록상 소유권 이전(purchase)이지만, 유저에게는 '나눔'으로 보여야 한다
    if (content.startsWith('[나눔 요청]')) {
      return {
        category: 'request',
        transactionType: 'purchase',
        mode: 'give',
        bookId,
        displayText: cleanContent.replace(/^\[나눔 요청\]\s*/, ''),
      };
    }

    // Check for acceptance messages
    if (content.startsWith('[대여 수락]')) {
      return {
        category: 'accepted',
        transactionType: 'rent',
        mode: 'rent',
        bookId,
        displayText: cleanContent,
      };
    }
    if (content.startsWith('[판매 완료]')) {
      return {
        category: 'accepted',
        transactionType: 'purchase',
        mode: 'sell',
        bookId,
        displayText: cleanContent,
      };
    }
    if (content.startsWith('[나눔 완료]')) {
      return {
        category: 'accepted',
        transactionType: 'purchase',
        mode: 'give',
        bookId,
        displayText: cleanContent,
      };
    }

    // Check for return messages
    if (content.startsWith('[반납 완료]')) {
      return {
        category: 'returned',
        transactionType: 'rent',
        mode: 'rent',
        bookId,
        displayText: cleanContent,
      };
    }

    if (content.startsWith('[반납 요청]')) {
      return {
        category: 'return_request',
        transactionType: 'rent',
        mode: 'rent',
        bookId,
        displayText: cleanContent.replace(/^\[반납 요청\]\s*/, ''),
      };
    }

    return {
      category: 'regular',
      transactionType: 'rent',
      mode: 'rent',
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
        .select('id, title, author, cover_url, mode')
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

  // Close "더보기" popup on outside click
  useEffect(() => {
    if (!showMore) return;
    const handler = (e: MouseEvent) => {
      if (showMoreRef.current && !showMoreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMore]);

  // Derive the primary book this conversation is about (first BOOK_ID found in messages)
  const conversationBook = useMemo(() => {
    if (conversation.book) return conversation.book;
    for (const msg of messages) {
      const bookId = extractBookId(msg.content);
      if (bookId && bookInfoCache[bookId]) return bookInfoCache[bookId];
    }
    return null;
  }, [messages, bookInfoCache, conversation.book]);

  // Active transactions with the conversation partner
  const conversationTransactions = useMemo(() => {
    if (!conversation.other_user || !user) return [];
    return transactions.filter(t =>
      (t.status === 'active' || t.status === 'pending') &&
      ((t.owner_id === user.id && t.borrower_id === conversation.other_user!.id) ||
        (t.borrower_id === user.id && t.owner_id === conversation.other_user!.id))
    );
  }, [transactions, conversation.other_user?.id, user?.id]);

  const getTransactionStatusText = (t: typeof transactions[0]) => {
    if (t.type === 'purchase') return '판매 완료';
    const base = t.isMine ? '대여해줌' : '대여중';
    if (t.return_date) {
      return `${base} · ${format(new Date(t.return_date), 'M월 d일 반납', { locale: ko })}`;
    }
    return base;
  };

  const fetchOtherUserBooks = async () => {
    if (!conversation.other_user) return;
    setLoadingBooks(true);
    const { data } = await supabase
      .from('books')
      .select('id, title, author, cover_url, status')
      .eq('owner_id', conversation.other_user.id)
      .eq('is_public', true)
      .order('status', { ascending: false }); // available first
    setOtherUserBooks(data || []);
    setLoadingBooks(false);
  };

  const handleRentFromMenu = async () => {
    setShowMore(false);
    await fetchOtherUserBooks();
    setShowBookPicker(true);
  };

  const handleReturnRequestFromMenu = async () => {
    setShowMore(false);
    const borrowedTx = transactions.find(
      t => !t.isMine && t.status === 'active' && t.type === 'rent' &&
        conversation.other_user && t.owner_id === conversation.other_user.id
    );
    if (!borrowedTx) {
      toast.error('진행 중인 대여가 없습니다');
      return;
    }
    const msg = `[반납 요청] 책: ${borrowedTx.book?.title || '책'} 을 반납하겠습니다. [BOOK_ID:${borrowedTx.book_id}]`;
    await sendMessage(msg);
    toast.success('반납했다고 알렸어요');
  };

  const handleBookPickerSelect = async (book: BookInfo) => {
    setShowBookPicker(false);
    const msg = `[대여 요청] [BOOK_ID:${book.id}]`;
    await sendMessage(msg);
    toast.success('대여 요청을 보냈습니다');
  };

  const RESERVED_PREFIXES = ['[대여 요청]', '[구매 요청]', '[나눔 요청]', '[대여 수락]', '[판매 완료]', '[나눔 완료]', '[반납 완료]', '[반납 요청]'];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    if (RESERVED_PREFIXES.some(p => newMessage.trimStart().startsWith(p))) {
      toast.error('사용할 수 없는 메시지 형식입니다');
      return;
    }

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
    <div className="flex flex-col h-full">
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

        {/* Book cover thumbnail */}
        {conversationBook?.cover_url && (
          <img
            src={conversationBook.cover_url}
            alt={conversationBook.title}
            className="w-7 h-10 object-cover rounded shrink-0 shadow-sm"
          />
        )}

        <div className="flex-1 min-w-0">
          <h2 className="font-display text-[16px] font-medium tracking-tight text-foreground truncate leading-tight">
            {conversation.other_user?.nickname}
          </h2>
          {conversationBook && (
            <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
              {conversationBook.title}
            </p>
          )}
        </div>
      </header>

      {/* Transaction Status Banner */}
      {conversationTransactions.length > 0 && (
        <button
          type="button"
          onClick={() => setShowTransactionDashboard(true)}
          className="border-b border-border shrink-0 bg-muted/30 hover:bg-muted/50 transition-colors w-full text-left"
        >
          <div className="flex items-center gap-3 px-4 py-2.5">
            {/* Book cover stack (up to 3, overlapping) */}
            <div className="flex items-center shrink-0" style={{ marginRight: conversationTransactions.length > 1 ? '8px' : '0' }}>
              {conversationTransactions.slice(0, 3).map((t, i) => (
                <div
                  key={t.id}
                  className="relative shadow-sm"
                  style={{ marginLeft: i > 0 ? '-10px' : '0', zIndex: 3 - i }}
                >
                  {t.book?.cover_url ? (
                    <img src={t.book.cover_url} alt={t.book.title}
                      className="w-8 h-11 object-cover rounded border-2 border-card" />
                  ) : (
                    <div className="w-8 h-11 bg-muted rounded border-2 border-card flex items-center justify-center">
                      <BookPickIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Info text */}
            <div className="flex-1 min-w-0">
              {conversationTransactions.length === 1 ? (
                <>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {conversationTransactions[0].book?.title || '책'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getTransactionStatusText(conversationTransactions[0])}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-foreground">
                    {conversationTransactions.length}권 거래 중
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {conversationTransactions.filter(t => t.isMine).length > 0 && `대여해줌 ${conversationTransactions.filter(t => t.isMine).length}권`}
                    {conversationTransactions.filter(t => t.isMine).length > 0 && conversationTransactions.filter(t => !t.isMine).length > 0 && ' · '}
                    {conversationTransactions.filter(t => !t.isMine).length > 0 && `대여중 ${conversationTransactions.filter(t => !t.isMine).length}권`}
                  </p>
                </>
              )}
            </div>

            {/* Direction badge + arrow */}
            {conversationTransactions.length === 1 && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                conversationTransactions[0].isMine
                  ? 'bg-bookmark-lent/20 text-bookmark-lent'
                  : 'bg-primary/10 text-primary'
              }`}>
                {conversationTransactions[0].type === 'purchase' ? '판매완료'
                  : conversationTransactions[0].isMine ? '대여해줌' : '대여중'}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 ml-1" />
          </div>
        </button>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <div className="flex flex-col justify-end min-h-full p-4 space-y-3">
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
            const isImage = parsed.category === 'image';
            const bookInfo = parsed.bookId ? bookInfoCache[parsed.bookId] : null;
            
            // Find transaction for this book
            const activeTransaction = parsed.bookId ? findActiveTransaction(parsed.bookId) : null;
            
            // Determine if current user can take action
            // For request: owner (not the sender) can accept
            const isBookOwner = bookInfo && msg.sender_id !== user?.id;
            const canAccept = parsed.category === 'request' && isBookOwner && !activeTransaction;
            
            // For accepted: owner can confirm return completion
            const canShowReturnButton = parsed.category === 'accepted' &&
              parsed.transactionType === 'rent' &&
              activeTransaction &&
              activeTransaction.isMine &&
              isOwn;

            // For return_request: owner sees "반납 수락" button (borrower sent the message, so !isOwn for owner)
            const canAcceptReturn = parsed.category === 'return_request' &&
              activeTransaction &&
              activeTransaction.isMine &&
              !isOwn;

            // Borrower can request return (shown on accepted message, for the borrower)
            const canRequestReturn = parsed.category === 'accepted' &&
              parsed.transactionType === 'rent' &&
              activeTransaction &&
              !activeTransaction.isMine &&
              !isOwn;

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
                  <div className={`${isSpecialMessage && bookInfo ? 'w-[85%]' : 'max-w-[85%]'} min-w-0 ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    {/* Special Card Messages */}
                    {isSpecialMessage && bookInfo && (
                      <div className="w-full">
                        <RentalMessageCard
                          type={parsed.category as RentalMessageType}
                          transactionType={parsed.transactionType}
                          mode={parsed.mode}
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
                          showRequestReturnButton={canRequestReturn}
                          onRequestReturnClick={async () => {
                            if (!bookInfo) return;
                            const msg = `[반납 요청] 책: ${bookInfo.title} 을 반납하겠습니다. [BOOK_ID:${bookInfo.id}]`;
                            await sendMessage(msg);
                            toast.success('반납했다고 알렸어요');
                          }}
                          showAcceptReturnButton={canAcceptReturn}
                          onAcceptReturnClick={() => {
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
                    
                    {/* Image Message (PayNow·PayLah QR 등) */}
                    {isImage && (
                      <div className={`flex items-end gap-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                        {isOwn && !msg.is_read && (
                          <span className="text-[11px] font-bold text-primary leading-none mb-1 shrink-0">1</span>
                        )}
                        <div className="flex flex-col gap-1">
                          <a href={parsed.displayText} target="_blank" rel="noopener noreferrer">
                            <img
                              src={parsed.displayText}
                              alt="첨부 이미지"
                              className="max-w-[220px] w-full rounded-2xl border border-border shadow-sm"
                            />
                          </a>
                          <p className={`text-xs ${isOwn ? 'text-right text-muted-foreground' : 'text-muted-foreground'}`}>
                            {format(new Date(msg.created_at), 'a h:mm', { locale: ko })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Regular Message Bubble */}
                    {!isSpecialMessage && (
                      <div className={`flex items-end gap-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* KakaoTalk-style unread "1" */}
                        {isOwn && !msg.is_read && (
                          <span className="text-[11px] font-bold text-primary leading-none mb-1 shrink-0">1</span>
                        )}
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
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-border bg-card shrink-0">
        <div className="flex gap-2 items-center">
          {/* More actions button */}
          {/* + 버튼 → 카메라/앨범 선택 (PayNow·PayLah QR 등) */}
          <div className="relative shrink-0">
            {/* 앨범에서 선택 — capture 없음 */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            {/* 카메라로 촬영 — capture로 후면 카메라를 바로 연다 (모바일) */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageSelect}
            />
            <button
              type="button"
              onClick={() => setShowAttachSheet(true)}
              disabled={uploadingImage}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 transition-colors text-muted-foreground disabled:opacity-50"
              aria-label="사진 첨부"
            >
              {uploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>

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

      {/* 사진 첨부 방식 선택 시트 */}
      {showAttachSheet && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center"
          onClick={() => setShowAttachSheet(false)}
        >
          <div
            className="w-full max-w-[520px] bg-card rounded-t-2xl p-3 pb-6 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto w-9 h-1 rounded-full bg-border mb-2" />
            <button
              type="button"
              onClick={() => { setShowAttachSheet(false); cameraInputRef.current?.click(); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-muted transition-colors text-left"
            >
              <Camera className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-foreground">카메라로 촬영</span>
            </button>
            <button
              type="button"
              onClick={() => { setShowAttachSheet(false); imageInputRef.current?.click(); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-muted transition-colors text-left"
            >
              <ImageIcon className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-foreground">앨범에서 선택</span>
            </button>
          </div>
        </div>
      )}

      {/* Book Picker Modal */}
      {showBookPicker && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowBookPicker(false)}>
          <div
            className="w-full max-w-lg bg-card rounded-t-2xl max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h3 className="font-display text-lg font-medium tracking-tight text-foreground">대여할 책 선택</h3>
              <button
                type="button"
                onClick={() => setShowBookPicker(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingBooks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : otherUserBooks.length === 0 ? (
                <div className="text-center py-8">
                  <BookPickIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">대여 가능한 책이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {otherUserBooks.map(book => {
                    const isAvailable = book.status === 'available';
                    return (
                      <button
                        key={book.id}
                        type="button"
                        onClick={isAvailable ? () => handleBookPickerSelect(book) : undefined}
                        disabled={!isAvailable}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                          isAvailable
                            ? 'hover:bg-muted cursor-pointer'
                            : 'opacity-40 cursor-not-allowed'
                        }`}
                      >
                        {book.cover_url ? (
                          <img src={book.cover_url} alt={book.title} className="w-10 h-14 object-cover rounded-lg shrink-0" />
                        ) : (
                          <div className="w-10 h-14 bg-muted rounded-lg flex items-center justify-center shrink-0">
                            <BookPickIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">{book.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{book.author}</p>
                        </div>
                        {!isAvailable && (
                          <span className="text-[10px] font-medium text-muted-foreground shrink-0 bg-muted px-2 py-0.5 rounded-full">
                            {book.status === 'rented' ? '대여중' : '거래완료'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
              
              // 나눔·판매는 거래상 둘 다 purchase지만, 화면 문구는 책의 실제 모드로 구분한다
              const bookMode = bookInfoCache[selectedBookId!].mode;
              let confirmMessage: string;
              if (acceptRequestType === 'rent') {
                const returnDateStr = returnDate
                  ? format(new Date(returnDate), 'yyyy년 M월 d일', { locale: ko })
                  : '미정';
                confirmMessage = `[대여 수락] 책: ${bookInfoCache[selectedBookId!].title} | 대여일: ${startDateStr} | 반납예정일: ${returnDateStr} [BOOK_ID:${selectedBookId}]`;
              } else if (bookMode === 'give') {
                confirmMessage = `[나눔 완료] 책: ${bookInfoCache[selectedBookId!].title} | 거래일: ${startDateStr} [BOOK_ID:${selectedBookId}]`;
              } else {
                confirmMessage = `[판매 완료] 책: ${bookInfoCache[selectedBookId!].title} | 거래일: ${startDateStr} [BOOK_ID:${selectedBookId}]`;
              }
              await sendMessage(confirmMessage);

              await refreshTransactions();

              toast.success(
                acceptRequestType === 'rent'
                  ? '대여가 수락되었습니다!'
                  : bookMode === 'give'
                  ? '나눔이 완료되었습니다!'
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
               await handleReturnCompletion({
                 transactionId: selectedTransaction.id,
                 book: {
                   id: selectedBookId,
                   title: bookInfoCache[selectedBookId!].title,
                   author: bookInfoCache[selectedBookId!].author || '',
                   cover_url: bookInfoCache[selectedBookId!].cover_url,
                 },
                 conversationId: conversation.id,
                 userId: user!.id,
               });
               
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

      {/* Transaction Dashboard Modal */}
      <TransactionDashboard
        isOpen={showTransactionDashboard}
        onClose={() => setShowTransactionDashboard(false)}
        partnerId={conversation.other_user?.id}
      />
    </div>
  );
};
