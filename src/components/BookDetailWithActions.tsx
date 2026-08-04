import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, Heart, Edit2, Trash2, Loader2, Clock, Flag, BookOpen } from 'lucide-react';
import { Book } from '@/types/book';
import { BookMode, MODE_EYEBROW, MODE_CTA, availabilityLabel } from '@/lib/bookMode';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MemberProfileModal } from '@/components/profile/MemberProfileModal';
import { ReportModal } from '@/components/report/ReportModal';
import { useGuestGate } from '@/hooks/useGuestGate';
import { useNavigate } from 'react-router-dom';
import { track } from '@/lib/analytics';
import { DefaultBookCover } from '@/components/DefaultBookCover';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BookDetailWithActionsProps {
  book: Book | null;
  onClose: () => void;
  onChat: (ownerId: string, bookId: string, bookMode: BookMode) => void;
  onEdit?: (book: Book) => void;
  onDelete?: (bookId: string) => Promise<void>;
  isLiked?: boolean;
  onToggleLike?: (book: Book) => Promise<void>;
  currentUserId?: string;
  /** 내가 등록한 책 수 — 0이면 대여/나눔 요청 시 게이트 후보 */
  myBookCount?: number;
  /** 내가 지금까지 빌린 횟수 — 첫 대여(0)는 무료, 그 뒤부터 책 1권 등록 요구 */
  myBorrowCount?: number;
}

interface SiblingBook {
  id: string;
  status: 'available' | 'rented' | 'sold';
  mode: BookMode;
  owner_id: string;
  owner?: { nickname: string; avatar_url?: string | null };
}

// Truncate description to max 4 lines (roughly 200 chars)
const truncateDescription = (text: string, maxLength: number = 200): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

export const BookDetailWithActions = ({ 
  book, 
  onClose, 
  onChat, 
  onEdit,
  onDelete,
  isLiked = false,
  onToggleLike,
  currentUserId,
  myBookCount,
  myBorrowCount,
}: BookDetailWithActionsProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showBorrowGate, setShowBorrowGate] = useState(false);
  const navigate = useNavigate();
  const { requireAuth } = useGuestGate();

  /**
   * 요청(대여/나눔/구매) 시도. 대여·나눔은 "내 책 1권 이상 등록" 필요 —
   * 서로 내놓는 책장이라서다. 단 첫 대여는 무료(부담 없이 시작),
   * 두 번째부터는 책 0권이면 등록 유도 게이트를 띄운다.
   * (구매는 돈을 내는 거래라 게이트 없음)
   */
  const tryRequest = (ownerId: string, bookId: string, mode: BookMode) => {
    if (!requireAuth()) return;
    // 첫 요청은 무료, 그 뒤부터 책 0권이면 등록 유도.
    // "이미 해봤는지"는 과거 요청 메시지(hasRequestedBefore) 또는 승인된 대여(myBorrowCount)로 판단.
    const usedFreeBorrow = hasRequestedBefore || (myBorrowCount ?? 0) >= 1;
    if ((mode === 'rent' || mode === 'give') && myBookCount === 0 && usedFreeBorrow) {
      track('borrow_gate_shown', { book_id: bookId, mode });
      setShowBorrowGate(true);
      return;
    }
    onChat(ownerId, bookId, mode);
    onClose();
  };
  const [deleting, setDeleting] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showOwnerProfile, setShowOwnerProfile] = useState(false);
  const [isInWaitlist, setIsInWaitlist] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [siblingBooks, setSiblingBooks] = useState<SiblingBook[]>([]);
  // 내가 이미 대여/나눔 요청을 보낸 적 있는지 — "첫 요청은 무료" 게이트 판단용.
  // 요청은 거래(transactions)가 아니라 메시지로 남으므로 메시지에서 센다.
  const [hasRequestedBefore, setHasRequestedBefore] = useState(false);

  useEffect(() => {
    if (!book) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [book, onClose]);

  // Reset siblings when book changes
  useEffect(() => {
    setSiblingBooks([]);
    if (!book) return;
    supabase
      .from('books')
      .select('id, status, mode, owner_id, profile:profiles!books_owner_id_fkey(nickname, avatar_url)')
      .ilike('title', book.title)
      .ilike('author', book.author)
      .neq('id', book.id)
      .eq('is_public', true)
      .neq('status', 'sold')
      .then(({ data }) => {
        if (!data) return;
        setSiblingBooks(data.map((row: any) => ({
          id: row.id,
          status: row.status,
          mode: row.mode,
          owner_id: row.owner_id,
          owner: row.profile ? { nickname: row.profile.nickname, avatar_url: row.profile.avatar_url } : undefined,
        })));
      });
  }, [book?.id]);

  // Load waitlist info when a rented book is shown
  useEffect(() => {
    if (!book || book.status !== 'rented' || !currentUserId) return;
    const load = async () => {
      const [myEntry, countResult] = await Promise.all([
        supabase.from('book_waitlist').select('id').eq('book_id', book.id).eq('user_id', currentUserId).maybeSingle(),
        supabase.from('book_waitlist').select('id', { count: 'exact' }).eq('book_id', book.id),
      ]);
      setIsInWaitlist(!!myEntry.data);
      setWaitlistCount(countResult.count ?? 0);
    };
    load();
  }, [book?.id, book?.status, currentUserId]);

  // 게이트 판단: 책 0권인 사람이 상세를 열면, 과거 대여/나눔 요청 이력이 있는지 확인.
  // (책이 1권 이상이면 게이트가 아예 없으니 조회하지 않는다.)
  useEffect(() => {
    if (!book || !currentUserId || myBookCount !== 0) { setHasRequestedBefore(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('messages')
        .select('content')
        .eq('sender_id', currentUserId)
        .ilike('content', '%요청]%')
        .limit(20);
      if (cancelled) return;
      const requested = (data ?? []).some((m: { content: string }) =>
        /^\[(대여|나눔) 요청\]/.test(m.content ?? ''));
      setHasRequestedBefore(requested);
    })();
    return () => { cancelled = true; };
  }, [book?.id, currentUserId, myBookCount]);

  const handleWaitlist = async () => {
    if (!book || !currentUserId) return;
    setWaitlistLoading(true);
    if (isInWaitlist) {
      await supabase.from('book_waitlist').delete().eq('book_id', book.id).eq('user_id', currentUserId);
      setIsInWaitlist(false);
      setWaitlistCount(c => Math.max(0, c - 1));
      toast.success('대기열에서 취소했습니다');
    } else {
      const { error } = await supabase.from('book_waitlist').insert({ book_id: book.id, user_id: currentUserId });
      if (error) { toast.error('대기 등록에 실패했습니다'); }
      else { setIsInWaitlist(true); setWaitlistCount(c => c + 1); toast.success('대기열에 등록되었습니다. 반납 시 알림을 드릴게요!'); }
    }
    setWaitlistLoading(false);
  };

  if (!book) return null;

  const isOwner = currentUserId === book.owner_id;
  const hasValidCover = book.cover && book.cover.length > 0;

  // 이 책이 허용하는 거래 방식(중복 가능). allow_* 우선, 없으면 대표 mode.
  const enabledModes: BookMode[] = ([
    book.allowRent ? 'rent' : null,
    book.allowGive ? 'give' : null,
    book.allowSell ? 'sell' : null,
  ].filter(Boolean) as BookMode[]);
  const modesForLabel: BookMode[] = enabledModes.length ? enabledModes : [book.mode];

  // 상태 줄 라벨 — 여러 방식이면 "대여 가능 · 무료 나눔"처럼 모두 표기.
  const statusText =
    book.status === 'rented'
      ? '대여중'
      : modesForLabel
          .map((m) =>
            m === 'rent'
              ? `대여 가능${waitlistCount > 0 ? ` · ${waitlistCount}명 대기` : ''}`
              : availabilityLabel(m, book.price),
          )
          .join(' · ');

  // 책 상태(S/A/B)를 뜻과 3단계 눈금으로. "상태 A"만 보면 뜻을 모른다.
  const CONDITION_META = {
    S: { word: '새 책', level: 3, good: true },
    A: { word: '양호', level: 2, good: true },
    B: { word: '보통', level: 1, good: false },
  } as const;
  const cond = CONDITION_META[book.condition] ?? CONDITION_META.A;

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    await onDelete(book.id);
    setDeleting(false);
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleLike = async () => {
    if (!onToggleLike) return;
    setLikeLoading(true);
    try {
      await onToggleLike(book);
      toast.success(isLiked ? '관심 도서에서 제거했습니다' : '관심 도서에 추가했습니다');
    } catch (err) {
      toast.error('업데이트에 실패했습니다');
    } finally {
      setLikeLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {book && (
          <motion.div
            data-ptr-ignore
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            {/* 하단 시트 — 아래로 드래그하거나 바깥을 탭하면 닫힌다 */}
            <motion.div
              className="w-full max-w-[520px] box-border bg-card overflow-hidden flex flex-col max-h-[88vh]"
              style={{ borderRadius: 'var(--sheet-radius) var(--sheet-radius) 0 0' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 500) onClose();
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 1. 그랩 핸들 */}
              <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing">
                <div className="w-[38px] h-1 rounded-full bg-[#D3CCBC]" />
              </div>

              <div className="flex-1 overflow-y-auto px-5 pt-3 pb-5 min-h-0">
                {/* 2. 표지 + 제목/저자 */}
                <div className="flex gap-4">
                  <div className="w-[92px] shrink-0 aspect-[2/3] rounded-xl overflow-hidden shadow-hip">
                    {hasValidCover ? (
                      <img src={book.cover} alt={book.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <DefaultBookCover title={book.title} author={book.author} className="w-full h-full" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pt-1">
                    {/* 상태등 + 영문 모드 + 한글 상태를 한 줄로. 예전엔 이 정보가
                        eyebrow·배지·배지 세 곳에 흩어져 같은 말을 세 번 했다. */}
                    {/* 여러 방식이면 영문 eyebrow는 대표 하나만(길게 겹쳐 못생기지 않게),
                        한글 상태줄이 '대여 가능 · 무료 나눔'처럼 전부 나열한다. flex-wrap으로 X와 안 겹침. */}
                    <div className="flex items-center gap-1.5 flex-wrap pr-6">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          book.status === 'available'
                            ? 'bg-green-500'
                            : book.status === 'rented'
                            ? 'bg-red-500'
                            : 'bg-muted-foreground'
                        )}
                      />
                      <span className="eyebrow">{MODE_EYEBROW[modesForLabel[0]]}</span>
                      <span
                        className={cn(
                          'text-[13px] font-semibold',
                          book.status === 'available'
                            ? 'text-green-600 dark:text-green-500'
                            : book.status === 'rented'
                            ? 'text-red-500'
                            : 'text-muted-foreground'
                        )}
                      >
                        · {statusText}
                      </span>
                    </div>
                    <h2 className="font-display text-[22px] leading-tight text-foreground mt-1">
                      {book.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">{book.author}</p>
                  </div>

                  <button
                    onClick={onClose}
                    className="self-start p-1.5 rounded-full text-muted-foreground hover:bg-muted transition-colors shrink-0"
                    aria-label="닫기"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 3. 책 상태 — 뜻 + 3단계 눈금(컴팩트, 왼쪽에 붙여 한 그룹) */}
                <div className="flex items-center gap-2.5 mt-4">
                  <span className="eyebrow">책 상태</span>
                  <span
                    className={cn(
                      'text-[14px] font-bold',
                      cond.good ? 'text-green-600 dark:text-green-500' : 'text-amber-600 dark:text-amber-500'
                    )}
                  >
                    {cond.word}
                  </span>
                  <div className="flex gap-1 items-center">
                    {[1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          'w-5 h-1.5 rounded-full',
                          i <= cond.level
                            ? cond.good
                              ? 'bg-green-500'
                              : 'bg-amber-500'
                            : 'bg-muted'
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* 4. 책 주인 — 얇은 한 줄 */}
                <button
                  className="w-full mt-3 pt-3 border-t border-border flex items-center gap-2.5 text-left"
                  onClick={() => setShowOwnerProfile(true)}
                >
                  <Avatar className="w-[30px] h-[30px] shrink-0">
                    <AvatarImage src={book.owner?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {book.owner?.nickname?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[15.5px] font-bold text-foreground truncate min-w-0">
                    {book.owner?.nickname || '알 수 없음'}
                  </span>
                  <span className="text-[13px] text-muted-foreground shrink-0">님의 책장</span>
                  {book.community && (
                    <span className="px-2 py-0.5 rounded-full text-[12px] font-semibold shrink-0 bg-[#EFEAF6] text-[#6E5B9E]">
                      📚 {book.community.name}
                    </span>
                  )}
                  <span className="ml-auto text-[13.5px] font-bold text-primary shrink-0">프로필 ›</span>
                </button>

                {/* 5. 소개 */}
                {book.description && (
                  <p className="text-[15px] leading-[1.6] text-muted-foreground mt-4">
                    {truncateDescription(book.description)}
                  </p>
                )}

                {/* 이 책을 가진 다른 이웃 */}
                {siblingBooks.length > 0 && (
                  <div className="mt-5">
                    <p className="eyebrow mb-2.5">이 책을 가진 다른 이웃 ({siblingBooks.length})</p>
                    <div className="space-y-2">
                      {siblingBooks.map((sibling) => (
                        <div key={sibling.id} className="bg-muted/60 rounded-xl p-3 flex items-center gap-3">
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarImage src={sibling.owner?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {sibling.owner?.nickname?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <p className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">
                            {sibling.owner?.nickname || '알 수 없음'}
                          </p>
                          <span
                            className={`text-[13px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                              sibling.status === 'available'
                                ? 'border border-primary text-primary'
                                : 'bg-secondary text-secondary-foreground'
                            }`}
                          >
                            {sibling.status === 'available' ? '대여 가능' : '대여중'}
                          </span>
                          {sibling.status === 'available' && currentUserId && sibling.owner_id !== currentUserId && (
                            <button
                              className="text-[13px] px-2.5 py-1.5 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shrink-0"
                              onClick={() => tryRequest(sibling.owner_id, sibling.id, sibling.mode)}
                            >
                              요청
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. 액션 — 코랄 풀폭 CTA + 위시(하트) 48px */}
              <div className="shrink-0 px-5 pt-3 pb-5 border-t border-border bg-card">
                <div className="flex gap-2.5">
                  {isOwner ? (
                    <>
                      <button
                        className="flex-1 btn-hip flex items-center justify-center gap-2"
                        onClick={() => onEdit?.(book)}
                      >
                        <Edit2 className="w-4 h-4" />
                        수정
                      </button>
                      <button
                        className="flex-1 py-3 px-4 rounded-full bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2 hover:bg-destructive/20 transition-colors"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="w-4 h-4" />
                        삭제
                      </button>
                    </>
                  ) : book.status === 'rented' ? (
                    <button
                      className={`btn-hip flex-1 flex items-center justify-center gap-2 ${isInWaitlist ? 'opacity-70' : ''}`}
                      onClick={() => { if (requireAuth()) handleWaitlist(); }}
                      disabled={waitlistLoading}
                    >
                      {waitlistLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                      {isInWaitlist ? '대기 취소' : `대기 신청${waitlistCount > 0 ? ` (${waitlistCount}명)` : ''}`}
                    </button>
                  ) : (
                    <div className="flex-1 flex flex-col gap-2">
                      {enabledModes.map((m, i) => (
                        <button
                          key={m}
                          className={`flex items-center justify-center gap-2 ${i === 0 ? 'btn-hip' : 'py-3 px-4 rounded-full border border-primary/50 text-primary font-semibold hover:bg-primary/5 transition-colors'}`}
                          onClick={() => tryRequest(book.owner_id, book.id, m)}
                        >
                          <MessageCircle className="w-4 h-4" />
                          {MODE_CTA[m]}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 관심(하트) — 내 책은 찜할 수 없으니 소유자에겐 숨긴다 */}
                  {!isOwner && (
                    <button
                      className={`w-12 h-12 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
                        isLiked
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:text-primary hover:border-primary'
                      }`}
                      onClick={() => { if (requireAuth()) handleLike(); }}
                      disabled={likeLoading}
                      aria-label="관심 도서"
                    >
                      {likeLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                      )}
                    </button>
                  )}

                  {/* 신고 — 내 책에는 노출하지 않는다 */}
                  {!isOwner && currentUserId && (
                    <button
                      className="w-12 h-12 shrink-0 rounded-full border border-border text-muted-foreground hover:text-destructive hover:border-destructive flex items-center justify-center transition-colors"
                      onClick={() => { if (requireAuth()) setShowReport(true); }}
                      aria-label="이 책 신고하기"
                    >
                      <Flag className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl max-w-[90vw] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>이 책을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              "{book.title}"을(를) 책장에서 영구적으로 삭제합니다. 이 작업은 취소할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-xl">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Owner Profile Modal */}
      <MemberProfileModal
        isOpen={showOwnerProfile}
        onClose={() => setShowOwnerProfile(false)}
        userId={book.owner_id}
      />

      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        targetType="book"
        targetId={book.id}
        reportedUserId={book.owner_id}
        targetLabel={book.title}
        context={`${book.title} / ${book.author}${book.description ? ` — ${book.description}` : ''}`}
      />

      {/* 대여/나눔 게이트 — 내 책 0권일 때: 서로 내놓는 책장이라 1권 등록 후 이용 */}
      <AnimatePresence>
        {showBorrowGate && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowBorrowGate(false)}
          >
            <motion.div
              className="w-full max-w-sm bg-card rounded-2xl shadow-2xl p-6 text-center"
              initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-[20px] font-medium text-foreground mb-1.5">책을 한 권 등록해주세요</h3>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                다음 대여부터는 내 책을 1권 이상 등록해야 빌릴 수 있어요.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setShowBorrowGate(false); onClose(); navigate('/?tab=upload'); }}
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold"
                >
                  내 책 등록하기
                </button>
                <button
                  onClick={() => setShowBorrowGate(false)}
                  className="w-full h-11 rounded-xl text-muted-foreground text-sm"
                >
                  나중에
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
