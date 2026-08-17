import type { BookCondition } from '@/lib/bookCondition';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Save } from 'lucide-react';
import { Book } from '@/types/book';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ConditionSelector } from '@/components/upload/ConditionSelector';
import { ModeToggle } from '@/components/upload/ModeToggle';
import { CommunitySelector } from '@/components/upload/CommunitySelector';
import { CoverUploader } from '@/components/upload/CoverUploader';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { BookMode } from '@/lib/bookMode';

interface EditBookModalProps {
  book: Book | null;
  onClose: () => void;
  onSave: (bookId: string, updates: Partial<Book>) => Promise<{ error: Error | null }>;
}

export const EditBookModal = ({ book, onClose, onSave }: EditBookModalProps) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    description: '',
    coverUrl: '',
    condition: 'A' as BookCondition,
    allowRent: true,
    allowSell: false,
    allowGive: false,
    price: '',
    isPublic: true,
    communityId: null as string | null,
  });

  // 대표 모드(호환용): 판매 > 대여 > 나눔 우선순위
  const primaryMode = (): BookMode => (formData.allowSell ? 'sell' : formData.allowRent ? 'rent' : 'give');

  // Populate form when book changes
  useEffect(() => {
    if (book) {
      setFormData({
        title: book.title,
        author: book.author,
        description: book.description || '',
        coverUrl: book.cover || '',
        condition: book.condition,
        allowRent: book.allowRent,
        allowSell: book.allowSell,
        allowGive: book.allowGive,
        price: book.price?.toString() || '',
        isPublic: book.is_public,
        communityId: book.community_id,
      });
    }
  }, [book]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book) return;

    if (!formData.title.trim() || !formData.author.trim()) {
      toast.error('제목과 저자를 입력해주세요');
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

    if (!formData.isPublic && !formData.communityId) {
      toast.error('비공개 책은 커뮤니티를 선택해주세요');
      return;
    }

    setSaving(true);
    const { error } = await onSave(book.id, {
      title: formData.title.trim(),
      author: formData.author.trim(),
      description: formData.description.trim() || null,
      cover: formData.coverUrl || null,
      condition: formData.condition,
      mode: primaryMode(),
      allowRent: formData.allowRent,
      allowSell: formData.allowSell,
      allowGive: formData.allowGive,
      price: formData.allowSell ? parseFloat(formData.price) : null,
      is_public: formData.isPublic,
      community_id: formData.isPublic ? null : formData.communityId,
    });
    setSaving(false);

    if (error) {
      toast.error('수정에 실패했어요', { description: error.message });
    } else {
      toast.success('책 정보를 수정했어요');
      onClose();
    }
  };

  if (!book) return null;

  return (
    <AnimatePresence>
      {book && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-[calc(100%-2rem)] max-w-lg box-border"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={handleSubmit}
              className="bg-card rounded-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl"
            >
              {/* Header */}
              <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <h2 className="font-display text-[22px] font-medium tracking-tight text-foreground">책 정보 수정</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </header>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Cover Uploader */}
                {user && (
                  <CoverUploader
                    coverUrl={formData.coverUrl}
                    userId={user.id}
                    onCoverChange={(url) => setFormData(prev => ({ ...prev, coverUrl: url }))}
                    disabled={saving}
                  />
                )}

                {/* Title */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Title</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Book title"
                    maxLength={200}
                    className="bg-muted border-0"
                  />
                </div>

                {/* Author */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Author</label>
                  <Input
                    value={formData.author}
                    onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                    placeholder="Author name"
                    maxLength={100}
                    className="bg-muted border-0"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Description</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description (optional)"
                    maxLength={1000}
                    className="bg-muted border-0 min-h-[100px] resize-none"
                  />
                </div>

                {/* Condition */}
                <ConditionSelector
                  value={formData.condition}
                  onChange={(condition) => setFormData(prev => ({ ...prev, condition }))}
                />

                {/* Mode — 여러 개 선택 가능 */}
                <ModeToggle
                  allowRent={formData.allowRent}
                  allowSell={formData.allowSell}
                  allowGive={formData.allowGive}
                  onToggle={(mode) => setFormData(prev => ({
                    ...prev,
                    allowRent: mode === 'rent' ? !prev.allowRent : prev.allowRent,
                    allowSell: mode === 'sell' ? !prev.allowSell : prev.allowSell,
                    allowGive: mode === 'give' ? !prev.allowGive : prev.allowGive,
                    // 판매를 끄면 가격 초기화
                    price: mode === 'sell' && prev.allowSell ? '' : prev.price,
                  }))}
                />

                {/* Price (for sell mode) */}
                <AnimatePresence>
                  {formData.allowSell && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      <label className="text-sm font-medium text-foreground">판매 가격 (S$)</label>
                      <Input
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="bg-muted border-0"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Visibility */}
                <CommunitySelector
                  isPublic={formData.isPublic}
                  selectedCommunityId={formData.communityId}
                  onPublicChange={(isPublic) => setFormData(prev => ({ ...prev, isPublic }))}
                  onCommunityChange={(communityId) => setFormData(prev => ({ ...prev, communityId }))}
                />
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border shrink-0">
                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
