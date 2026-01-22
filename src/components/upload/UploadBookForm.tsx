import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Loader2, ImagePlus, Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BookSearchInput } from './BookSearchInput';
import { ConditionSelector } from './ConditionSelector';
import { ModeToggle } from './ModeToggle';
import { CommunitySelector } from './CommunitySelector';
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
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [showManualCover, setShowManualCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  // Summarize description using AI
  const summarizeDescription = async (description: string): Promise<string> => {
    if (!description || description.length <= 200) return description;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ description, language: 'ko' }),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.summary || description.slice(0, 200) + '...';
      }
    } catch (error) {
      console.error('Summarization failed:', error);
    }
    
    // Fallback: simple truncation
    return description.slice(0, 200) + '...';
  };

  useEffect(() => {
    const fillBookDetails = async () => {
      if (!selectedBook) return;
      
      setIsFetchingDetails(true);
      setShowManualCover(false);
      
      // Fetch description
      const description = await fetchBookDetails(selectedBook.key);
      
      // Summarize if too long
      const summarizedDescription = description 
        ? await summarizeDescription(description)
        : '';
      
      setFormData((prev) => ({
        ...prev,
        title: selectedBook.title,
        author: selectedBook.author,
        coverUrl: selectedBook.cover || '',
        description: summarizedDescription,
      }));
      
      // Show manual cover option if no cover found
      if (!selectedBook.cover) {
        setShowManualCover(true);
      }
      
      setIsFetchingDetails(false);
    };

    fillBookDetails();
  }, [selectedBook, fetchBookDetails]);

  const handleClearBook = () => {
    setSelectedBook(null);
    setShowManualCover(false);
    setFormData((prev) => ({
      ...prev,
      title: '',
      author: '',
      description: '',
      coverUrl: '',
    }));
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploadingCover(true);

    try {
      // Convert to base64 for preview (temporary - would use storage bucket in production)
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, coverUrl: reader.result as string }));
        setIsUploadingCover(false);
        setShowManualCover(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload cover image');
      setIsUploadingCover(false);
    }
  };

  const handleRemoveCover = () => {
    setFormData(prev => ({ ...prev, coverUrl: '' }));
    setShowManualCover(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please sign in to upload a book');
      return;
    }

    if (!formData.title.trim() || !formData.author.trim()) {
      toast.error('Please fill in the book title and author');
      return;
    }

    if (formData.mode === 'sell' && (!formData.price || parseFloat(formData.price) <= 0)) {
      toast.error('Please enter a valid price for selling');
      return;
    }

    if (!formData.isPublic && !formData.communityId) {
      toast.error('Please select a community for private books');
      return;
    }

    setIsSubmitting(true);

    try {
      // For base64 covers, we'd normally upload to storage first
      // For now, store as URL or null
      const coverUrl = formData.coverUrl.startsWith('http') ? formData.coverUrl : null;

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
      setShowManualCover(false);
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
      {/* Book Search */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">책 검색</label>
        <p className="text-xs text-muted-foreground">한국어와 영어 제목 모두 지원</p>
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

      {/* Cover Preview or Upload */}
      <div className="space-y-3">
        {formData.coverUrl ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center"
          >
            <div className="relative">
              <img
                src={formData.coverUrl}
                alt={formData.title}
                className="w-32 h-44 object-cover rounded-lg shadow-lg"
              />
              <button
                type="button"
                onClick={handleRemoveCover}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground p-1.5 rounded-full shadow-md hover:bg-destructive/90 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ) : showManualCover || !selectedBook ? null : null}

        {/* Manual Cover Upload Button */}
        {(showManualCover || (formData.title && !formData.coverUrl)) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingCover}
              className="gap-2"
            >
              {isUploadingCover ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              표지 사진 업로드
            </Button>
            <p className="text-xs text-muted-foreground">
              표지를 찾을 수 없나요? 직접 업로드하세요
            </p>
          </motion.div>
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
