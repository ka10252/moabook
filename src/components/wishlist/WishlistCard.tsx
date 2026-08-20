import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { Trash2, Check, MessageCircle, Pencil, Loader2 } from 'lucide-react';
import { WishlistItem } from '@/hooks/useWishlist';
import { spineClassFrom } from '@/lib/spineColor';
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

interface WishlistCardProps {
  item: WishlistItem;
  isOwner: boolean;
  /** 실패 시 throw 하면 카드가 다이얼로그를 닫지 않는다(피드백은 부모가 토스트) */
  onDelete?: () => Promise<void> | void;
  onMarkFulfilled?: () => Promise<void> | void;
  onMessage?: () => Promise<void> | void;
  /** 내 한마디 수정 (소유자만) */
  onEditNotes?: (notes: string) => Promise<void> | void;
  /** 실제 요청이 아직 적을 때 채워 넣는 예시 카드 — 진짜인 척하면 안 된다 */
  isDemo?: boolean;
  /** 내 책장에 같은 제목이 있음 — 바로 빌려줄 수 있는 요청이다(F5) */
  canOffer?: boolean;
}

/**
 * 위시리스트 카드 — 책등 색 블록 + 제목/저자 + 한 줄 메모.
 * 표지 이미지는 없다(아직 존재하지 않는 책이니까). 대신 책등 색으로 서가와 같은 언어를 쓴다.
 */
export const WishlistCard = ({
  item,
  isOwner,
  onDelete,
  onMarkFulfilled,
  onMessage,
  onEditNotes,
  isDemo = false,
  canOffer = false,
}: WishlistCardProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFulfillConfirm, setShowFulfillConfirm] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [draft, setDraft] = useState(item.notes ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fulfilling, setFulfilling] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const nickname = item.profile?.nickname || '익명';

  const saveNote = async () => {
    setSavingNote(true);
    await onEditNotes?.(draft);
    setSavingNote(false);
    setEditingNote(false);
  };

  // 실패 시 부모가 throw → 다이얼로그를 닫지 않는다(사용자가 재시도 가능).
  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete?.(); setShowDeleteConfirm(false); }
    catch { /* 부모 토스트 */ }
    finally { setDeleting(false); }
  };

  const handleFulfill = async () => {
    setFulfilling(true);
    try { await onMarkFulfilled?.(); setShowFulfillConfirm(false); }
    catch { /* 부모 토스트 */ }
    finally { setFulfilling(false); }
  };

  const handleMessageClick = async () => {
    if (messaging) return; // 연타로 중복 문의 전송 방지
    setMessaging(true);
    try { await onMessage?.(); }
    finally { setMessaging(false); }
  };

  return (
    <>
      {/**
       * 요청 말풍선.
       *
       * 위시리스트의 주인공은 책이 아니라 **“누가 찾고 있는가”** 다.
       * 채팅처럼 생겨서 말 걸기가 자연스럽고, 누구에게 답하는지가 분명하다.
       * (한 줄 리스트보다 한 화면에 적게 담기는 건 감수한다 — 훑기보다 말 걸기가 목적이다)
       */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        className={`flex items-start gap-2 px-0.5 py-2 ${isDemo ? 'opacity-70' : ''}`}
      >
        {/* 프로필 사진 — 없으면 닉네임 첫 글자로 떨어진다 */}
        <Avatar className="w-7 h-7 shrink-0 mt-0.5">
          <AvatarImage src={item.profile?.avatar_url || undefined} alt={nickname} />
          <AvatarFallback className="bg-[hsl(var(--primary-soft))] text-primary text-[12px] font-bold">
            {nickname.charAt(0)}
          </AvatarFallback>
        </Avatar>

        {/* 말풍선 — 왼쪽 위만 각지게 해서 아바타에서 뻗어 나온 것처럼 보이게 한다 */}
        <div className="flex-1 min-w-0 bg-muted/50 border border-border rounded-[4px_14px_14px_14px] px-3 py-2.5">
          <p className="text-[12px] text-muted-foreground mb-1.5">
            <b className="text-foreground font-semibold">{nickname}</b>님이 찾아요
            {isDemo && <span className="ml-1.5 text-[11px] font-bold text-faint bg-muted px-1.5 py-0.5 rounded-full">예시</span>}
          </p>

          <div className="flex items-center gap-2.5 min-w-0">
            {item.cover_url ? (
              <img
                src={item.cover_url}
                alt={item.title}
                loading="lazy"
                className="w-[30px] h-[42px] rounded-[3px] shrink-0 object-cover bg-muted"
                style={{ boxShadow: '0 4px 8px -4px rgba(0,0,0,.5)' }}
              />
            ) : (
              <div
                className={`w-[30px] h-[42px] rounded-[3px] shrink-0 ${spineClassFrom(item.title)}`}
                style={{ boxShadow: '0 4px 8px -4px rgba(0,0,0,.5)' }}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-[14px] font-bold leading-tight text-foreground truncate">{item.title}</p>
                {/* 내 책장에 같은 제목이 있다 — 이 목록에서 유일하게 행동으로 이어지는 신호다 */}
                {canOffer && !isDemo && (
                  <span className="text-[11px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">있어요</span>
                )}
                {item.desired_mode === 'rent' && (
                  <span className="shrink-0 text-[11px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">대여</span>
                )}
                {item.desired_mode === 'buy' && (
                  <span className="shrink-0 text-[11px] font-semibold text-amber-700 bg-amber-500/15 px-1.5 py-0.5 rounded-full">구입</span>
                )}
              </div>
              {item.author && <p className="text-[12px] text-muted-foreground truncate">{item.author}</p>}
            </div>
          </div>

          {/* 한마디 — 말풍선 안의 말. 없으면 줄을 만들지 않는다. */}
          {!editingNote && item.notes && (
            <p className="text-[13px] text-muted-foreground mt-2 leading-snug whitespace-pre-wrap break-words">
              “{item.notes}”
            </p>
          )}

          {editingNote && (
            <div className="mt-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                maxLength={200}
                autoFocus
                placeholder="어떤 판본을 원하는지 등 한마디"
                className="w-full text-[15px] bg-background border border-border rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
              <div className="flex justify-end gap-1.5 mt-1.5">
                <button onClick={() => setEditingNote(false)} className="text-[13px] text-muted-foreground px-2 py-1">취소</button>
                <button
                  onClick={saveNote}
                  disabled={savingNote}
                  className="text-[13px] font-semibold text-primary-foreground bg-primary rounded-full px-3 py-1 flex items-center gap-1 disabled:opacity-70"
                >
                  {savingNote && <Loader2 className="w-3 h-3 animate-spin" />} 저장
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-0.5 shrink-0">
          {!isOwner && onMessage && (
            <button
              onClick={handleMessageClick}
              disabled={messaging}
              className="tap-44 p-1.5 rounded-full text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
              title="이 사람에게 메시지"
            >
              {messaging ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <MessageCircle className="w-[18px] h-[18px]" />}
            </button>
          )}
          {isOwner && onEditNotes && !isDemo && !editingNote && (
            <button
              onClick={() => { setDraft(item.notes ?? ''); setEditingNote(true); }}
              className="tap-44 p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title={item.notes ? '한마디 수정' : '한마디 추가'}
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {isOwner && onMarkFulfilled && (
            <button
              onClick={() => setShowFulfillConfirm(true)}
              className="tap-44 p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="찾았어요"
            >
              <Check className="w-[18px] h-[18px]" />
            </button>
          )}
          {isOwner && onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="tap-44 p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="삭제"
            >
              <Trash2 className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>
      </motion.div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>이 요청을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              위시리스트 요청을 삭제합니다. 이 작업은 취소할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* '찾았어요' 확인 — 되돌릴 수 없으니(목록에서 내려감) 한 번 확인 */}
      <AlertDialog open={showFulfillConfirm} onOpenChange={setShowFulfillConfirm}>
        <AlertDialogContent className="rounded-2xl max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>이 책을 찾으셨나요?</AlertDialogTitle>
            <AlertDialogDescription>
              "{item.title}"을(를) 찾은 것으로 표시하고 위시리스트에서 내립니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleFulfill(); }}
              disabled={fulfilling}
              className="rounded-xl"
            >
              {fulfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : '찾았어요'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
