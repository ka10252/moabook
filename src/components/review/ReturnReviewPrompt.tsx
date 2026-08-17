import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBookReviews } from '@/hooks/useBookReviews';
import { useBackClose } from '@/hooks/useBackClose';
import { StarRating } from './StarRating';

interface Props {
  bookId: string;
  bookTitle: string;
  /** 뒤로가기 등으로 그냥 닫힘 — 다음에 다시 물어도 된다 */
  onClose: () => void;
  /** '건너뛰기'를 직접 눌렀다 — 이 책은 다시 묻지 않는다 */
  onSkip?: () => void;
  /** 리뷰를 실제로 남긴 경우. 안 주면 onClose로 대신한다 */
  onSaved?: () => void;
}

/**
 * 반납 직후 뜨는 리뷰 팝업.
 *
 * 책을 막 돌려준 순간이 리뷰를 받기 제일 좋은 때다. 하루만 지나도
 * 앱에 다시 들어와 그 책을 찾아 들어가는 사람은 거의 없다.
 * 그래서 여기서 안 받으면 사실상 못 받는다고 보는 게 맞다.
 *
 * 다만 강요하면 안 된다 — 별점만 누르고 끝낼 수 있게 두고, 건너뛰기를 항상 남긴다.
 */
export function ReturnReviewPrompt({ bookId, bookTitle, onClose, onSkip, onSaved }: Props) {
  const { save, saving } = useBookReviews(bookId);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  useBackClose(true, onClose);

  const submit = async () => {
    if (rating < 1) { toast.error('별점을 골라주세요'); return; }
    const { error } = await save(rating, comment);
    if (error) { toast.error('리뷰를 저장하지 못했어요'); return; }
    toast.success('리뷰 고마워요');
    (onSaved ?? onClose)();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-card rounded-2xl p-5 space-y-4"
      >
        <div>
          <h2 className="text-[17px] font-bold text-foreground">이 책 어땠어요?</h2>
          <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2">{bookTitle}</p>
        </div>

        <div className="flex justify-center py-1">
          <StarRating value={rating} onChange={setRating} size={34} />
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 200))}
          placeholder="한 줄로 남겨주세요 (선택)"
          rows={2}
          className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border-0 text-[15px] text-foreground placeholder:text-muted-foreground resize-none focus-visible:ring-2 focus-visible:ring-primary outline-none"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSkip ?? onClose}
            className="flex-1 h-12 rounded-xl border border-border text-[15px] text-muted-foreground"
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground text-[15px] font-bold disabled:opacity-60 flex items-center justify-center"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '남기기'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
