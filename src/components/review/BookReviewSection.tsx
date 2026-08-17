import { useEffect, useState } from 'react';
import { Loader2, PencilLine, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useBookReviews } from '@/hooks/useBookReviews';
import { StarRating } from './StarRating';

interface Props {
  bookId: string;
  /** 반납 직후 팝업에서 넘어온 경우 입력창을 펼친 채로 연다 */
  autoOpenForm?: boolean;
}

/**
 * 책 상세의 리뷰 영역 — 설명 아래에 붙는다.
 *
 * 표시 순서: 평균 → 내 리뷰(쓰기/고치기) → 남들 리뷰.
 * 내 것을 위에 두는 이유는, 리뷰가 쌓인 책에서 자기 것을 찾으려고
 * 목록을 훑게 만들면 고칠 마음이 사라지기 때문이다.
 */
export function BookReviewSection({ bookId, autoOpenForm }: Props) {
  const { user } = useAuth();
  const { reviews, myReview, average, count, loading, saving, save, remove } = useBookReviews(bookId);
  const [open, setOpen] = useState(!!autoOpenForm);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [expanded, setExpanded] = useState(false);

  // 내 리뷰를 불러오면 폼에 채운다(고치기).
  useEffect(() => {
    if (myReview) { setRating(myReview.rating); setComment(myReview.comment ?? ''); }
  }, [myReview]);

  useEffect(() => { if (autoOpenForm) setOpen(true); }, [autoOpenForm]);

  const others = reviews.filter((r) => r.user_id !== user?.id);

  const submit = async () => {
    if (rating < 1) { toast.error('별점을 골라주세요'); return; }
    const { error } = await save(rating, comment);
    if (error) { toast.error('리뷰를 저장하지 못했어요'); return; }
    toast.success(myReview ? '리뷰를 고쳤어요' : '리뷰를 남겼어요');
    setOpen(false);
  };

  const handleRemove = async () => {
    const { error } = await remove();
    if (error) { toast.error('삭제하지 못했어요'); return; }
    setRating(0); setComment(''); setOpen(false);
    toast.success('리뷰를 지웠어요');
  };

  return (
    <section className="pt-4 mt-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-bold text-foreground">리뷰</h3>
        {count > 0 ? (
          <div className="flex items-center gap-1.5">
            <StarRating value={average ?? 0} size={14} />
            <span className="text-[13px] font-semibold text-foreground">{average?.toFixed(1)}</span>
            <span className="text-[12px] text-muted-foreground">({count})</span>
          </div>
        ) : (
          <span className="text-[12px] text-muted-foreground">아직 없어요</span>
        )}
        {others.length > 1 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto text-[12.5px] font-semibold text-muted-foreground hover:text-foreground shrink-0"
          >
            {expanded ? '접기' : `더보기 ${others.length - 1}`}
          </button>
        )}
      </div>

      {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}

      {/* 내 리뷰 */}
      {user && !open && (
        myReview ? (
          <div className="rounded-xl border border-border p-3 mb-3">
            <div className="flex items-center gap-2">
              <StarRating value={myReview.rating} size={14} />
              <span className="text-[11px] text-muted-foreground">내 리뷰</span>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="ml-auto p-1.5 -m-1.5 text-muted-foreground hover:text-foreground"
                aria-label="리뷰 고치기"
              >
                <PencilLine className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={saving}
                className="p-1.5 -m-1.5 ml-2 text-muted-foreground hover:text-destructive"
                aria-label="리뷰 지우기"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {myReview.comment && (
              <p className="text-[13px] text-foreground mt-1.5 leading-relaxed">{myReview.comment}</p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full h-11 rounded-xl border border-border text-[13.5px] font-semibold text-foreground hover:bg-muted/60 mb-3"
          >
            이 책 어땠어요?
          </button>
        )
      )}

      {/* 입력 폼 */}
      {user && open && (
        <div className="rounded-xl border border-border p-3 mb-3 space-y-2.5">
          <StarRating value={rating} onChange={setRating} size={26} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 200))}
            placeholder="한 줄로 남겨주세요 (선택)"
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-muted/50 border-0 text-[13.5px] text-foreground placeholder:text-muted-foreground resize-none focus-visible:ring-2 focus-visible:ring-primary outline-none"
          />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-faint">{comment.length}/200</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto px-3 h-9 rounded-lg text-[13px] text-muted-foreground"
            >
              취소
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="px-4 h-9 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (myReview ? '고치기' : '남기기')}
            </button>
          </div>
        </div>
      )}

      {/* 남들 리뷰 — 기본은 대표 1개만.
          책 상세는 "빌릴지 말지" 정하는 화면이라, 리뷰가 쌓였다고 여기서 다 읽게 하면
          정작 아래 대여 버튼이 화면 밖으로 밀려난다. 더 보고 싶은 사람만 펼친다. */}
      {others.length > 0 && (
        <div className="space-y-3">
          {(expanded ? others : others.slice(0, 1)).map((r) => (
            <div key={r.id} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-muted overflow-hidden shrink-0">
                {r.author?.avatar_url && (
                  <img src={r.author.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12.5px] font-semibold text-foreground truncate">
                    {r.author?.nickname ?? '이웃'}
                  </span>
                  <StarRating value={r.rating} size={12} />
                </div>
                {r.comment && (
                  <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{r.comment}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!user && count === 0 && (
        <p className="text-[12px] text-faint">로그인하면 리뷰를 남길 수 있어요.</p>
      )}
    </section>
  );
}
