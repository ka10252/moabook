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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { BookMode, CURRENCY } from '@/lib/bookMode';

interface BookFormData {
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  condition: 'S' | 'A' | 'B';
  mode: BookMode;
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
  // 판매인데 사진이 없으면 제출을 시도한 뒤에야 붉게 알린다 (입력 전부터 빨갛게 하지 않는다)
  const [coverMissing, setCoverMissing] = useState(false);

  const [formData, setFormData] = useState<BookFormData>({
    title: '',
    author: '',
    description: '',
    coverUrl: '',
    condition: 'A',
    mode: 'rent',
    price: '',
    isPublic: true,
    communityId: null,
  });

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

    if (formData.mode === 'sell' && (!formData.price || parseFloat(formData.price) <= 0)) {
      toast.error('판매 가격을 입력해주세요');
      return;
    }

    // 판매는 돈이 오간다. 사는 사람이 상태를 눈으로 확인할 수 없으면 분쟁이 난다.
    if (formData.mode === 'sell' && !formData.coverUrl) {
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
        mode: formData.mode,
        price: formData.mode === 'sell' ? parseFloat(formData.price) : null,
        is_public: formData.isPublic,
        community_id: formData.communityId,
        owner_id: user.id,
      });

      if (error) throw error;

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
        mode: 'rent',
        price: '',
        isPublic: true,
        communityId: null,
      });

      // 등록 후 빈 폼에 머무르지 않고 메인 책장으로 이동해 등록된 책을 바로 확인하게 한다
      onUploaded?.();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('책 등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSell = formData.mode === 'sell';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 사진 — 판매는 필수, 대여는 권장 */}
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

      {/* Manual Entry Fields */}
      <div className="space-y-4">
        {/* 제목 입력 = 검색. 결과를 고르면 저자·설명이 자동으로 채워지고,
            결과가 없으면 입력한 텍스트가 그대로 제목이 된다. */}
        <div className="space-y-2">
          <p className="text-[12px] font-bold tracking-wide text-muted-foreground">책 제목</p>
          <BookTitleSearch
            title={formData.title}
            onTitleChange={handleTitleChange}
            onBookSelect={handleBookSelect}
            matched={!!matched}
            matchedCover={matched?.cover}
          />
          <p className="text-[13px] text-faint">
            입력하면 책을 검색해요. 목록에서 고르면 저자·설명이 자동으로 채워집니다.
          </p>
          {isFetchingDetails && (
            <p className="text-[13px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              책 정보를 가져오는 중…
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[12px] font-bold tracking-wide text-muted-foreground">저자</p>
          <Input
            value={formData.author}
            onChange={(e) => setFormData((prev) => ({ ...prev, author: e.target.value }))}
            placeholder="저자 이름"
            className="h-11 text-[15px] bg-card border-border rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <p className="text-[12px] font-bold tracking-wide text-muted-foreground">설명 (선택)</p>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="책에 대한 간단한 설명…"
            rows={3}
            className="text-[15px] bg-card border-border rounded-xl resize-none"
          />
        </div>
      </div>

      <ConditionSelector
        value={formData.condition}
        onChange={(condition) => setFormData((prev) => ({ ...prev, condition }))}
      />

      <ModeToggle
        value={formData.mode}
        onChange={(mode) => {
          // 판매가 아니면 가격은 남길 이유가 없다 (S$0 같은 게 뜬다)
          setFormData((prev) => ({ ...prev, mode, price: mode === 'sell' ? prev.price : '' }));
          if (mode !== 'sell') setCoverMissing(false);
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
            <p className="text-[12px] font-bold tracking-wide text-muted-foreground">판매 가격 ({CURRENCY})</p>
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

      <CommunitySelector
        isPublic={formData.isPublic}
        selectedCommunityId={formData.communityId}
        onPublicChange={(isPublic) => setFormData((prev) => ({ ...prev, isPublic }))}
        onCommunityChange={(communityId) => setFormData((prev) => ({ ...prev, communityId }))}
      />

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
    </form>
  );
};
