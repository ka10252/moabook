import type { BookCondition } from '@/lib/bookCondition';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BookTitleSearch } from './BookTitleSearch';
import { ConditionSelector } from './ConditionSelector';
import { ModeToggle } from './ModeToggle';
import { CommunitySelector } from './CommunitySelector';
import { CoverUploader } from './CoverUploader';
import { BookSearchResult, useBookSearch } from '@/hooks/useBookSearch';
import { track } from '@/lib/analytics';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { BookMode, CURRENCY } from '@/lib/bookMode';
import { FirstBookNotifPrompt } from './FirstBookNotifPrompt';

interface BookFormData {
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  condition: BookCondition;
  allowRent: boolean;
  allowSell: boolean;
  allowGive: boolean;
  price: string;
  isPublic: boolean;
  communityId: string | null;
}

interface UploadBookFormProps {
  /** 등록 성공 후 호출 — 보통 메인 책장 탭으로 이동시킨다 */
  onUploaded?: () => void;
}

export const UploadBookForm = ({ onUploaded }: UploadBookFormProps) => {
  const { user } = useAuth();
  const { fetchBookDetails } = useBookSearch();
  // 검색으로 책을 매칭했는지 + 그 표지(확인용 썸네일). null이면 아직 검색으로 안 채운 상태.
  const [matched, setMatched] = useState<{ cover: string | null } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  // 판매인데 사진이 없으면 제출을 시도한 뒤에야 붉게 알린다 (입력 전부터 빨갛게 하지 않는다)
  const [coverMissing, setCoverMissing] = useState(false);
  // 제목 검색으로 채우기 전엔 저자·설명을 잠가, 사람들이 저자를 손으로 먼저 입력하지 않도록 유도.
  // 검색에 없는 책은 '직접 입력'으로 잠금 해제.
  const [manualEntry, setManualEntry] = useState(false);

  const [formData, setFormData] = useState<BookFormData>({
    title: '',
    author: '',
    description: '',
    coverUrl: '',
    condition: 'A',
    allowRent: true,
    allowSell: false,
    allowGive: false,
    price: '',
    isPublic: true,
    communityId: null,
  });

  // 대표 모드(호환용): 판매>대여>나눔 우선
  const primaryMode = (d: BookFormData): BookMode => (d.allowSell ? 'sell' : d.allowRent ? 'rent' : 'give');
  const toggleMode = (mode: BookMode) => setFormData((d) => ({
    ...d,
    allowRent: mode === 'rent' ? !d.allowRent : d.allowRent,
    allowSell: mode === 'sell' ? !d.allowSell : d.allowSell,
    allowGive: mode === 'give' ? !d.allowGive : d.allowGive,
  }));

  const truncateDescription = (description: string): string => {
    if (!description || description.length <= 300) return description;
    const firstParagraph = description.split(/\n\n|\r\n\r\n/)[0];
    if (firstParagraph.length <= 300) return firstParagraph;
    return description.slice(0, 300) + '...';
  };

  // 알라딘은 제목 필드에 "주제목 - 부제목, 마케팅 문구, 판형"을 통째로 넣는다.
  //   "린 스타트업 - 린 캔버스 창시자가... 전면 개정판"  →  "린 스타트업"
  //   "프로덕트 오너(조직을 성공으로 이끄는)"            →  "프로덕트 오너"
  // 책장에 꽂힐 이름이니 주제목만 남긴다. 유저가 원하면 아래 칸에서 다시 고칠 수 있다.
  const cleanBookTitle = (raw: string): string => {
    const mainTitle = raw.split(' - ')[0]; // " - " 뒤 부제목 제거
    return mainTitle.replace(/\s*\([^)]*\)\s*$/, '').trim() || raw.trim();
  };

  // 검색 결과에서 책을 골랐을 때 — 제목·저자·설명·표지를 자동으로 채운다.
  // matched.cover(알라딘 표지)는 확인용 썸네일이자, 유저가 사진을 따로 안 올리면
  // 그대로 책 표지로 저장된다 (제출 시 처리).
  const handleBookSelect = async (book: BookSearchResult) => {
    setMatched({ cover: book.cover });
    setIsFetchingDetails(true);

    // 알라딘은 검색 단계에서 이미 설명을 준다 — 없을 때만 추가로 가져온다
    let description = book.description;
    if (!description) {
      description = await fetchBookDetails(book.key);
    }

    setFormData((prev) => ({
      ...prev,
      title: cleanBookTitle(book.title),
      author: book.author,
      description: description ? truncateDescription(description) : '',
    }));

    setIsFetchingDetails(false);
  };

  // 제목을 직접 고쳐 쓰면 매칭 상태를 푼다 (썸네일 표시 해제). 값은 그대로 둔다.
  const handleTitleChange = (title: string) => {
    setMatched(null);
    setFormData((prev) => ({ ...prev, title }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('로그인이 필요합니다');
      return;
    }

    if (!formData.title.trim() || !formData.author.trim()) {
      toast.error('책 제목과 저자를 입력해주세요');
      return;
    }

    if (!formData.allowRent && !formData.allowSell && !formData.allowGive) {
      toast.error('거래 방식을 하나 이상 선택해주세요');
      return;
    }

    if (formData.allowSell && (!formData.price || parseFloat(formData.price) <= 0)) {
      toast.error('판매 가격을 입력해주세요');
      return;
    }

    // 판매는 돈이 오간다. 사는 사람이 상태를 눈으로 확인할 수 없으면 분쟁이 난다.
    if (formData.allowSell && !formData.coverUrl) {
      setCoverMissing(true);
      toast.error('판매하려면 책 상태 사진을 올려주세요');
      return;
    }

    if (!formData.isPublic && !formData.communityId) {
      toast.error('비공개 책은 커뮤니티를 선택해주세요');
      return;
    }

    setIsSubmitting(true);

    try {
      // 표지 우선순위:
      //   1) 유저가 올린 실제 상태 사진(formData.coverUrl) — 판매는 이게 필수
      //   2) 없으면 알라딘 카탈로그 표지(matched.cover) — 대여·나눔은 이걸로 충분
      const coverUrl =
        formData.coverUrl && formData.coverUrl.startsWith('http')
          ? formData.coverUrl
          : matched?.cover ?? null;

      const { error } = await supabase.from('books').insert({
        title: formData.title.trim(),
        author: formData.author.trim(),
        description: formData.description.trim() || null,
        cover_url: coverUrl,
        condition: formData.condition,
        mode: primaryMode(formData),
        allow_rent: formData.allowRent,
        allow_sell: formData.allowSell,
        allow_give: formData.allowGive,
        price: formData.allowSell ? parseFloat(formData.price) : null,
        is_public: formData.isPublic,
        community_id: formData.communityId,
        owner_id: user.id,
      } as never);

      if (error) throw error;

      // 퍼널 측정: '첫 책 등록' 단계. (타입엔 있었지만 실제 호출이 없어 미측정이던 이벤트)
      track('book_upload_completed', { mode: primaryMode(formData), has_photo: !!coverUrl });

      toast.success('책이 등록되었습니다!');

      // Reset form
      setCoverMissing(false);
      setMatched(null);
      setFormData({
        title: '',
        author: '',
        description: '',
        coverUrl: '',
        condition: 'A',
        // 초기 상태와 같은 모양으로 되돌린다. 예전엔 여기만 mode: 'rent'로 남아 있어서
        // 책을 등록하고 나면 allowRent/Sell/Give가 undefined가 되고 거래 방식이 아무것도
        // 선택되지 않은 채로 보였다.
        allowRent: true,
        allowSell: false,
        allowGive: false,
        price: '',
        isPublic: true,
        communityId: null,
      });

      // 첫 책 등록 + 아직 알림 미설정이면 → 알림 설정 유도 팝업(닫으면 서가로 이동).
      // 아니면 바로 서가로.
      let firstBookPrompt = false;
      try {
        if (!localStorage.getItem('moa_first_book_notif_seen')) {
          const [{ count }, { data: linked }] = await Promise.all([
            supabase.from('books').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
            supabase.rpc('am_i_telegram_linked' as any),
          ]);
          const hasTelegram = !!linked;
          if ((count ?? 0) <= 1 && !hasTelegram) {
            localStorage.setItem('moa_first_book_notif_seen', '1');
            setShowNotifPrompt(true);
            firstBookPrompt = true;
          }
        }
      } catch { /* 실패해도 등록 흐름은 계속 */ }

      // 팝업을 띄웠으면 이동은 팝업 닫을 때. 아니면 바로 메인 책장으로.
      if (!firstBookPrompt) onUploaded?.();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('책 등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSell = formData.allowSell;


  /**
   * 책을 고르기 전에는 제목 검색창 하나만 보여준다.
   *
   * 등록 탭 안내가 "제목만 입력하면 끝!"이라고 약속하는데, 예전엔 닫자마자 섹션 6개가
   * 한꺼번에 펼쳐져서 약속과 화면이 어긋났다. 제목을 정하기 전에는 나머지를 정할 수도 없다 —
   * 어떤 책인지 모르는 채로 '상태'를 고르는 건 순서가 뒤바뀐 것이다.
   *
   * 기준은 저자·설명 칸을 여는 조건과 같게 둔다. 한 글자만 쳐도 아래가 우르르 나타나면
   * 검색 목록이 떠 있는 동안 화면이 튄다.
   */
  const bookChosen = manualEntry || !!matched || !!formData.author.trim();

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Manual Entry Fields */}
      <div className="space-y-4">
        {/* 제목 입력 = 검색. 결과를 고르면 저자·설명이 자동으로 채워지고,
            결과가 없으면 입력한 텍스트가 그대로 제목이 된다. */}
        <div className="space-y-2">
          <p className="text-[13px] font-bold tracking-wide text-muted-foreground">책 제목</p>
          <BookTitleSearch
            title={formData.title}
            onTitleChange={handleTitleChange}
            onBookSelect={handleBookSelect}
            matched={!!matched}
            matchedCover={matched?.cover}
          />
          {isFetchingDetails && (
            <p className="text-[13px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              책 정보를 가져오는 중…
            </p>
          )}
        </div>

        {/* 책을 고르기 전엔 저자·설명 칸을 아예 숨기고 안내 카드만 둔다(잠긴 회색 칸보다 자연스럽고,
            저자를 손으로 먼저 입력하는 문제도 방지). 책을 고르면(matched) 자동으로 나타나 수정 가능.
            검색에 없는 책은 '직접 입력'으로 칸을 연다. */}
        {(() => {
          const fieldsReady = manualEntry || !!matched || !!formData.author.trim() || !!formData.description.trim();
          if (!fieldsReady) {
            return (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center space-y-2">
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  위에서 <b className="text-foreground">책 제목을 검색해 고르면</b><br />저자·설명이 자동으로 채워져요.
                </p>
                <button
                  type="button"
                  onClick={() => setManualEntry(true)}
                  className="text-[13px] text-primary font-medium underline underline-offset-2"
                >
                  검색에 없는 책은 직접 입력하기
                </button>
              </div>
            );
          }
          return (
            <>
              <div className="space-y-2">
                <p className="text-[13px] font-bold tracking-wide text-muted-foreground">저자</p>
                <Input
                  value={formData.author}
                  onChange={(e) => setFormData((prev) => ({ ...prev, author: e.target.value }))}
                  placeholder="저자 이름"
                  className="h-11 text-[15px] bg-card border-border rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <p className="text-[13px] font-bold tracking-wide text-muted-foreground">설명 (선택)</p>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="책에 대한 간단한 설명…"
                  rows={3}
                  className="text-[15px] bg-card border-border rounded-xl resize-none"
                />
              </div>
            </>
          );
        })()}
      </div>

      {/* 책을 고른 뒤에 나타나는 부분 — 사진 · 거래 방식 · 상태 · 공개 범위 */}
      <AnimatePresence initial={false}>
        {bookChosen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-5"
          >
          {/* 사진 — 제목 다음, 상태 앞. 제목을 고르면 표지가 자동으로 채워지므로
              "이미 표지가 있는데 왜 또 찍지?"를 막으려면 제목이 먼저 와야 한다.
              판매는 실물 사진이 필수, 대여·나눔은 권장이다. */}
          {user && (
            <CoverUploader
              coverUrl={formData.coverUrl}
              userId={user.id}
              onCoverChange={(url) => {
                setFormData((prev) => ({ ...prev, coverUrl: url }));
                if (url) setCoverMissing(false);
              }}
              disabled={isSubmitting}
              required={isSell}
              invalid={coverMissing && isSell && !formData.coverUrl}
            />
          )}

          <ModeToggle
            allowRent={formData.allowRent}
            allowSell={formData.allowSell}
            allowGive={formData.allowGive}
            onToggle={(mode) => {
              toggleMode(mode);
              // 판매를 끄면 가격/사진경고 초기화
              if (mode === 'sell' && formData.allowSell) {
                setFormData((prev) => ({ ...prev, price: '' }));
                setCoverMissing(false);
              }
            }}
          />

          {/* Price (for sell mode) */}
          <AnimatePresence>
            {isSell && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                <p className="text-[13px] font-bold tracking-wide text-muted-foreground">판매 가격 ({CURRENCY})</p>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="0"
                  className="h-11 text-[15px] bg-card border-border rounded-xl"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <ConditionSelector
            value={formData.condition}
            onChange={(condition) => setFormData((prev) => ({ ...prev, condition }))}
          />

          <CommunitySelector
            isPublic={formData.isPublic}
            selectedCommunityId={formData.communityId}
            onPublicChange={(isPublic) => setFormData((prev) => ({ ...prev, isPublic }))}
            onCommunityChange={(communityId) => setFormData((prev) => ({ ...prev, communityId }))}
          />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 등록 버튼도 책을 고른 뒤에 나온다 — 누를 수 없는 버튼을 미리 보여줄 이유가 없다 */}
      {bookChosen && (
      <Button
        type="submit"
        disabled={isSubmitting || !formData.title || !formData.author}
        className="w-full h-[52px] text-sm font-bold rounded-xl"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            등록 중…
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            책장에 등록
          </>
        )}
      </Button>
      )}

    </form>
    <FirstBookNotifPrompt
      isOpen={showNotifPrompt}
      onClose={() => { setShowNotifPrompt(false); onUploaded?.(); }}
    />
    </>
  );
};
