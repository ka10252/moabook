import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Loader2, Plus, Book as BookPickIcon, X, ChevronRight, Camera, ImageIcon, BookHeart } from 'lucide-react';
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
import { ReturnReviewPrompt } from '@/components/review/ReturnReviewPrompt';
import { MannerReviewModal } from '@/components/review/MannerReviewModal';
import { MemberProfileModal } from '@/components/profile/MemberProfileModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMannerReview } from '@/hooks/useMannerReview';
import { BookDetailWithActions } from '@/components/BookDetailWithActions';
import { transformDbBook, type Book } from '@/types/book';
import { TransactionDashboard } from '../transaction/TransactionDashboard';
import { RentalMessageCard, RentalMessageType, TransactionType } from './RentalMessageCard';
import { handleReturnCompletion } from '@/utils/transactionHelpers';
import { toast } from 'sonner';

interface BookInfo {
  id: string;
  /** 리뷰 버튼을 빌린 사람에게만 띄우려면 주인이 누구인지 알아야 한다 */
  owner_id?: string;
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
type MessageCategory = 'request' | 'accepted' | 'returned' | 'return_request' | 'image' | 'wish_offer' | 'regular';

interface ParsedMessage {
  category: MessageCategory;
  transactionType: TransactionType;
  /** 유저에게 보이는 실제 모드. 나눔·판매는 거래상 둘 다 purchase지만 화면 표기는 달라야 한다. */
  mode: 'rent' | 'sell' | 'give';
  bookId: string | null;
  displayText: string;
  /** 위시 '가지고 있어요' 카드의 표지 URL(있으면). 없으면 placeholder */
  wishCover?: string | null;
  /** 위시 카드에서 제안한 거래방식들(중복 가능) */
  wishModes?: ('rent' | 'give' | 'sell')[];
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
  // 이미 리뷰한 책 — 버튼 문구를 '리뷰 남기기'/'내 리뷰 보기'로 가른다
  const [reviewedBooks, setReviewedBooks] = useState<Set<string>>(new Set());
  const [reviewTarget, setReviewTarget] = useState<{ id: string; title: string } | null>(null);

  const openBookDetail = async (bookId: string) => {
    const { data, error } = await supabase
      .from('books')
      .select(`
        id, title, author, cover_url, condition, mode, price, description,
        is_public, community_id, owner_id, status, created_at, updated_at,
        profile:profiles!books_owner_id_fkey(nickname, avatar_url), community:communities(name)
      `)
      .eq('id', bookId)
      .single();
    if (error || !data) {
      toast.error('책 정보를 불러오지 못했습니다');
      return;
    }
    setDetailBook(transformDbBook(data as never));
  };
  const [showManner, setShowManner] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  // 채팅창 위에 덮어 띄우는 책 상세. bookInfoCache는 카드용 최소 필드만 갖고 있어서
  // 상세를 그리려면 책을 한 번 더 통째로 읽어야 한다.
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const otherUserId = conversation.other_user?.id ?? null;
  const { hasReviewed: mannerReviewed, reload: reloadManner } = useMannerReview(otherUserId);

  // 이 대화에 등장한 책들 중 내가 리뷰한 것 확인
  useEffect(() => {
    const ids = Object.keys(bookInfoCache);
    if (!user || ids.length === 0) return;
    let cancelled = false;
    supabase
      .from('book_reviews' as never)
      .select('book_id')
      .eq('user_id', user.id)
      .in('book_id', ids)
      .then(({ data }) => {
        if (cancelled) return;
        setReviewedBooks(new Set(((data ?? []) as unknown as Array<{ book_id: string }>).map(r => r.book_id)));
      });
    return () => { cancelled = true; };
  }, [bookInfoCache, user]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const firstScrollDoneRef = useRef(false);
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

    // 위시리스트 '이 책 가지고 있어요' 카드 — 책 등록물이 아니라 bookId가 없으므로 별도 경량 카드.
    // 형식: [위시 보유:rent,give,sell] {제목 · 저자} [WISHCOVER:url]  (모드 중복 가능)
    if (content.startsWith('[위시 보유')) {
      const raw = content.match(/^\[위시 보유(?::([\w,]+))?\]/)?.[1] ?? 'rent';
      const wishModes = raw.split(',').filter((m): m is 'rent' | 'give' | 'sell' =>
        m === 'rent' || m === 'give' || m === 'sell');
      const wishCover = content.match(/\[WISHCOVER:([^\]]+)\]/)?.[1] ?? null;
      const text = content
        .replace(/^\[위시 보유(?::[\w,]+)?\]\s*/, '')
        .replace(/\s*\[WISHCOVER:[^\]]+\]/, '')
        .trim();
      return {
        category: 'wish_offer',
        transactionType: 'rent',
        mode: wishModes[0] ?? 'rent',
        bookId: null,
        displayText: text,
        wishCover,
        wishModes: wishModes.length ? wishModes : ['rent'],
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
        .select('id, owner_id, title, author, cover_url, mode, status')
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

  /**
   * 대화방은 항상 맨 아래(가장 최신)에서 열려야 한다.
   *
   * 예전엔 messages가 바뀔 때마다 scrollIntoView({behavior:'smooth'}) 하나로 끝냈는데,
   * 방에 들어가면 중간쯤에서 멈춰 있었다. 이유가 두 가지다.
   *  1. 책 표지·카드 이미지가 **나중에** 로드되면서 위쪽 높이가 늘어나 내려둔 위치가 밀린다.
   *  2. smooth 애니메이션이 도는 중에 그 높이 변화가 일어나면 목적지가 어긋난 채로 끝난다.
   * 그래서 첫 진입은 즉시 붙이고, 그 뒤 높이가 변할 때마다 다시 붙인다.
   */
  const pinnedToBottomRef = useRef(true);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = scrollAreaRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // 대화방이 바뀌면 다시 '바닥에 붙은' 상태로 시작한다
  useEffect(() => {
    pinnedToBottomRef.current = true;
  }, [conversation.id]);

  useEffect(() => {
    if (!messages.length) return;
    // 첫 진입은 애니메이션 없이 바로 바닥으로. 스르륵 내려가는 걸 볼 이유가 없다.
    scrollToBottom(!firstScrollDoneRef.current ? false : pinnedToBottomRef.current);
    firstScrollDoneRef.current = true;
  }, [messages, scrollToBottom]);

  // 위로 올려 예전 대화를 읽는 중이면 새 메시지가 와도 끌어내리지 않는다
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const onScroll = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      pinnedToBottomRef.current = gap < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // 이미지가 늦게 로드돼 높이가 늘어나면 다시 바닥으로 붙인다 — 이게 없으면
  // 표지가 큰 카드가 있는 방은 항상 중간에서 멈춘다.
  useEffect(() => {
    const el = scrollAreaRef.current;
    const content = el?.firstElementChild;
    if (!el || !content) return;
    const ro = new ResizeObserver(() => {
      if (pinnedToBottomRef.current) scrollToBottom(false);
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [scrollToBottom]);

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
      .select('id, title, author, cover_url, status, mode')
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

  const handleBookPickerSelect = async (book: BookInfo) => {
    setShowBookPicker(false);
    // 책의 실제 거래유형에 맞는 요청을 보낸다(판매/나눔 책에 '대여 요청'이 가던 버그 수정)
    const prefix = book.mode === 'sell' ? '[구매 요청]' : book.mode === 'give' ? '[나눔 요청]' : '[대여 요청]';
    const label = book.mode === 'sell' ? '구매' : book.mode === 'give' ? '나눔' : '대여';
    const { error } = await sendMessage(`${prefix} [BOOK_ID:${book.id}]`);
    if (error) { toast.error('요청 전송에 실패했어요. 다시 시도해주세요.'); return; }
    toast.success(`${label} 요청을 보냈습니다`);
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

        {/* 맨 앞은 **상대 얼굴**이다. 지금 누구와 이야기하는지가 이 화면의 기준이고,
            책은 바로 아래 '거래 중' 배너에서 다시 확인할 수 있다.
            눌러서 상대 프로필(매너 평가·책장)로 들어갈 수 있게 버튼으로 감쌌다. */}
        <button
          type="button"
          onClick={() => conversation.other_user?.id && setProfileUserId(conversation.other_user.id)}
          className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
        >
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarImage src={conversation.other_user?.avatar_url || undefined} alt={conversation.other_user?.nickname || ''} />
            <AvatarFallback className="bg-secondary text-foreground text-[13px] font-semibold">
              {conversation.other_user?.nickname?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-[17px] font-medium tracking-tight text-foreground truncate leading-tight">
              {conversation.other_user?.nickname}
            </h2>
            {conversationBook && (
              <p className="text-[13px] text-muted-foreground truncate leading-tight mt-0.5">
                {conversationBook.title}
              </p>
            )}
          </div>
        </button>
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
              <span className={`text-[13px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
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
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
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
            // 판매·나눔은 거래가 'completed'로 생성돼 activeTransaction으로는 안 잡힌다.
            // 책이 이미 팔림/대여중이면(수락 완료) 재수락 불가 → 중복 거래 방지.
            const bookTaken = bookInfo?.status === 'sold' || bookInfo?.status === 'rented';
            const canAccept = parsed.category === 'request' && isBookOwner && !activeTransaction && !bookTaken;
            
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

            // 반납 완료 카드 → 빌린 사람(=책 주인이 아닌 쪽)에게만 리뷰 버튼.
            // owner_id로 판단한다. 메시지를 누가 보냈는지로 가르면, 빌린 사람이 직접
            // 반납 완료를 눌렀을 때 주인에게 리뷰 버튼이 뜨는 뒤집힘이 생긴다.
            const canLeaveReview = parsed.category === 'returned' &&
              !!bookInfo?.owner_id &&
              !!user &&
              bookInfo.owner_id !== user.id;

            // 빌린 사람의 '반납했어요' 버튼은 제거함 — 책 주인이 실제로 돌려받고 '반납 완료'를 누른다.

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
                  {/* 대여 요청·반납 완료 같은 카드는 화면 폭의 60%만 쓴다.
                      85%는 가로를 거의 다 먹어서 '메시지'가 아니라 '화면'처럼 보였다.
                      min-w: 좁은 폰에서 책 표지 + 제목 두 줄이 뭉개지지 않는 최소치. */}
                  <div className={`${isSpecialMessage && bookInfo ? 'w-[60%] min-w-[196px]' : 'max-w-[85%]'} min-w-0 ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
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
                          showReviewButton={canLeaveReview}
                          hasReviewed={!!bookInfo && reviewedBooks.has(bookInfo.id)}
                          onReviewClick={() => {
                            if (!bookInfo) return;
                            // 이미 썼으면 폼을 또 띄우지 않는다. 유저가 기대하는 건
                            // "내가 뭐라고 썼더라"이지 다시 쓰는 화면이 아니다.
                            // 대화 밖으로 튕겨보내지 않고 채팅창 위에 책 상세를 덮는다 —
                            // 화면이 통째로 바뀌면 대화로 돌아오는 길이 없어진다.
                            if (reviewedBooks.has(bookInfo.id)) {
                              void openBookDetail(bookInfo.id);
                              return;
                            }
                            setReviewTarget({ id: bookInfo.id, title: bookInfo.title });
                          }}
                          showMannerButton={parsed.category === 'returned' && !!otherUserId}
                          hasMannerReviewed={mannerReviewed}
                          onMannerClick={() => setShowManner(true)}
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
                          <span className="text-[13px] font-bold text-primary leading-none mb-1 shrink-0">1</span>
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

                    {/* 위시 '가지고 있어요' 카드 — bookId가 없어 RentalMessageCard를 못 쓰므로 경량 카드 */}
                    {parsed.category === 'wish_offer' && (
                      <div className={`flex items-end gap-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                        {isOwn && !msg.is_read && (
                          <span className="text-[13px] font-bold text-primary leading-none mb-1 shrink-0">1</span>
                        )}
                        <div className="flex flex-col gap-1">
                          <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] px-3.5 py-3 max-w-[260px]">
                            <div className="flex items-center gap-1.5 mb-2">
                              <BookHeart className="w-4 h-4 text-primary shrink-0" />
                              <p className="text-[13px] font-bold text-primary">위시 책을 가지고 있어요</p>
                            </div>
                            <div className="flex gap-2.5">
                              {parsed.wishCover ? (
                                <img src={parsed.wishCover} alt="" loading="lazy" className="w-11 h-16 object-cover rounded shrink-0 bg-muted" />
                              ) : (
                                <div className="w-11 h-16 rounded shrink-0 bg-muted flex items-center justify-center">
                                  <BookPickIcon className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-[15px] font-medium text-foreground leading-snug break-words">{parsed.displayText}</p>
                                <p className="text-[13px] text-primary font-semibold mt-1">
                                  {(parsed.wishModes ?? [parsed.mode])
                                    .map((m) => (m === 'give' ? '나눔' : m === 'sell' ? '판매' : '대여'))
                                    .join(' · ')}{' 가능해요'}
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className={`text-xs ${isOwn ? 'text-right' : ''} text-muted-foreground`}>
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
                          <span className="text-[13px] font-bold text-primary leading-none mb-1 shrink-0">1</span>
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
                          <img src={book.cover_url} alt={book.title} loading="lazy" decoding="async" className="w-10 h-14 object-cover rounded-lg shrink-0" />
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
                          <span className="text-[13px] font-medium text-muted-foreground shrink-0 bg-muted px-2 py-0.5 rounded-full">
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
          mode={bookInfoCache[selectedBookId].mode ?? 'rent'}
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
              // 수락 즉시 책 상태를 반영 → 같은 요청 카드로 재수락(중복 거래) 방지.
              // 대여=rented, 판매·나눔=sold. (bookInfoCache는 재조회되지 않으므로 여기서 갱신)
              setBookInfoCache((prev) =>
                prev[selectedBookId!]
                  ? { ...prev, [selectedBookId!]: { ...prev[selectedBookId!], status: acceptRequestType === 'rent' ? 'rented' : 'sold' } }
                  : prev
              );

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

      {/* 반납 완료 카드에서 연 리뷰 입력 */}
      <BookDetailWithActions
        book={detailBook}
        onClose={() => setDetailBook(null)}
        currentUserId={user?.id}
        // 이미 이 사람과 대화 중이다. 여기서 또 채팅을 열면 같은 방이 겹쳐 쌓인다.
        onChat={() => setDetailBook(null)}
      />

      <MemberProfileModal
        isOpen={!!profileUserId}
        onClose={() => setProfileUserId(null)}
        userId={profileUserId}
      />

      {showManner && otherUserId && (
        <MannerReviewModal
          userId={otherUserId}
          nickname={conversation.other_user?.nickname ?? '상대'}
          onClose={() => setShowManner(false)}
          onSaved={() => reloadManner()}
        />
      )}

      {reviewTarget && (
        <ReturnReviewPrompt
          bookId={reviewTarget.id}
          bookTitle={reviewTarget.title}
          onClose={() => setReviewTarget(null)}
          onSaved={() => {
            setReviewedBooks((prev) => new Set([...prev, reviewTarget.id]));
            setReviewTarget(null);
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
