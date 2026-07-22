import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Check, MessageCircle } from 'lucide-react';
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
  onDelete?: () => void;
  onMarkFulfilled?: () => void;
  onMessage?: () => void;
  /** 실제 요청이 아직 적을 때 채워 넣는 예시 카드 — 진짜인 척하면 안 된다 */
  isDemo?: boolean;
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
  isDemo = false,
}: WishlistCardProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const nickname = item.profile?.nickname || '익명';

  const handleDelete = () => {
    onDelete?.();
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`bg-card border border-border rounded-[14px] p-3 ${isDemo ? 'opacity-70' : ''}`}
      >
        <div className="flex items-center gap-3">
          {/* 책등 색 블록 */}
          <div
            className={`w-[38px] h-[54px] rounded-[3px] shrink-0 ${spineClassFrom(item.title)}`}
            style={{ boxShadow: '0 5px 10px -5px rgba(0,0,0,.5)' }}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="font-display text-[16px] leading-tight text-foreground truncate">
                {item.title}
              </p>
              {isDemo && (
                <span className="text-[9px] font-bold text-faint bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                  예시
                </span>
              )}
            </div>
            {item.author && <p className="text-[10px] text-faint mt-0.5 truncate">{item.author}</p>}
            <p className="text-[10px] text-faint mt-1 truncate">{nickname}</p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!isOwner && onMessage && (
              <button
                onClick={onMessage}
                className="p-2 rounded-full text-primary hover:bg-primary/10 transition-colors"
                title="이 사람에게 메시지"
              >
                <MessageCircle className="w-[18px] h-[18px]" />
              </button>
            )}

            {isOwner && onMarkFulfilled && (
              <button
                onClick={onMarkFulfilled}
                className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="찾았어요"
              >
                <Check className="w-[18px] h-[18px]" />
              </button>
            )}

            {isOwner && onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="삭제"
              >
                <Trash2 className="w-[18px] h-[18px]" />
              </button>
            )}
          </div>
        </div>

        {/* 한마디 — 요청자가 왜, 어떤 판본을 원하는지가 여기 담긴다.
            빌려줄지 말지를 결정하는 정보라서 카드 안에서 접지 않고 그대로 보여준다. */}
        {item.notes && (
          <div className="mt-2.5 rounded-xl bg-muted px-3 py-2.5">
            <p className="text-[10px] font-bold text-faint mb-1">
              {isOwner ? '내 한마디' : `${nickname}님의 한마디`}
            </p>
            <p className="text-[12px] text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
              {item.notes}
            </p>
          </div>
        )}
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
              onClick={handleDelete}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
