import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BookSearchInput } from './BookSearchInput';
import { ConditionSelector } from './ConditionSelector';
import { ModeToggle } from './ModeToggle';
import { CommunitySelector } from './CommunitySelector';
import { CoverUploader } from './CoverUploader';
import { BookSearchResult, useBookSearch } from '@/hooks/useBookSearch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface BookFormData {
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  condition: 'S' | 'A' | 'B';
  mode: 'rent' | 'sell';
  price: string;
  isPublic: boolean;
  communityId: string | null;
}

export const UploadBookForm = () => {
  const { user } = useAuth();
  const { fetchBookDetails } = useBookSearch();
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  
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

  useEffect(() => {
    const fillBookDetails = async () => {
      if (!selectedBook) return;

      setIsFetchingDetails(true);

      // Google Books already returns description in search results — skip re-fetch
      let description = selectedBook.description;
      if (!description) {
        description = await fetchBookDetails(selectedBook.key);
      }

      setFormData((prev) => ({
        ...prev,
        title: selectedBook.title,
        author: selectedBook.author,
        coverUrl: '',
        description: description ? truncateDescription(description) : '',
      }));

      setIsFetchingDetails(false);
    };

    fillBookDetails();
  }, [selectedBook, fetchBookDetails]);

  const handleClearBook = () => {
    setSelectedBook(null);
    setFormData((prev) => ({
      ...prev,
      title: '',
      author: '',
      description: '',
      coverUrl: '',
    }));
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

    if (!formData.isPublic && !formData.communityId) {
      toast.error('비공개 책은 커뮤니티를 선택해주세요');
      return;
    }

    setIsSubmitting(true);

    try {
      // Cover URL from storage
      const coverUrl = formData.coverUrl && formData.coverUrl.startsWith('http') 
        ? formData.coverUrl 
        : null;

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
      setSelectedBook(null);
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
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('책 등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Cover Uploader - Always visible first */}
      {user && (
        <CoverUploader
          coverUrl={formData.coverUrl}
          title={formData.title}
          author={formData.author}
          userId={user.id}
          onCoverChange={(url) => setFormData((prev) => ({ ...prev, coverUrl: url }))}
          disabled={isSubmitting}
        />
      )}

      {/* Book Search */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">책 검색 (선택)</label>
        <p className="text-xs text-muted-foreground">검색하면 제목, 저자, 설명이 자동 입력됩니다</p>
        <p className="text-xs text-muted-foreground">검색결과가 없으면 하단에 수동으로 입력하세요</p>
        <BookSearchInput
          selectedBook={selectedBook}
          onBookSelect={setSelectedBook}
          onClear={handleClearBook}
        />
        {isFetchingDetails && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            책 정보를 가져오는 중...
          </p>
        )}
      </div>

      {/* Manual Entry Fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">제목</label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="책 제목"
            className="h-12 bg-secondary border-border rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">저자</label>
          <Input
            value={formData.author}
            onChange={(e) => setFormData((prev) => ({ ...prev, author: e.target.value }))}
            placeholder="저자 이름"
            className="h-12 bg-secondary border-border rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">설명 (선택사항)</label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="책에 대한 간단한 설명..."
            rows={3}
            className="bg-secondary border-border rounded-xl resize-none"
          />
        </div>
      </div>

      {/* Condition Selector */}
      <ConditionSelector
        value={formData.condition}
        onChange={(condition) => setFormData((prev) => ({ ...prev, condition }))}
      />

      {/* Mode Toggle */}
      <ModeToggle
        value={formData.mode}
        onChange={(mode) => setFormData((prev) => ({ ...prev, mode }))}
      />

      {/* Price (for sell mode) */}
      <AnimatePresence>
        {formData.mode === 'sell' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <label className="text-sm font-medium text-foreground">가격 (₩)</label>
            <Input
              type="number"
              min="0"
              step="100"
              value={formData.price}
              onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
              placeholder="0"
              className="h-12 bg-secondary border-border rounded-xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Community Selector */}
      <CommunitySelector
        isPublic={formData.isPublic}
        selectedCommunityId={formData.communityId}
        onPublicChange={(isPublic) => setFormData((prev) => ({ ...prev, isPublic }))}
        onCommunityChange={(communityId) => setFormData((prev) => ({ ...prev, communityId }))}
      />

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isSubmitting || !formData.title || !formData.author}
        className="w-full h-14 text-base font-semibold rounded-2xl shadow-lg shadow-primary/20"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            등록 중...
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 mr-2" />
            책 등록하기
          </>
        )}
      </Button>
    </form>
  );
};
