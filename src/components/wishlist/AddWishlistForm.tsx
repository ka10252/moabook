import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Loader2, X, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { WishlistBookSearch } from './WishlistBookSearch';

interface AddWishlistFormProps {
  onAdd: (title: string, author: string | null, notes: string | null, desiredMode: 'rent' | 'buy' | 'any', coverUrl: string | null) => Promise<{ error: Error | null }>;
  onCancel: () => void;
}

type FormMode = 'search' | 'manual' | 'confirm';
type DesiredMode = 'rent' | 'buy' | 'any';

export const AddWishlistForm = ({ onAdd, onCancel }: AddWishlistFormProps) => {
  const [mode, setMode] = useState<FormMode>('search');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [notes, setNotes] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  // 대여/구매 구분은 받지 않는다 — 메신저에서 서로 합의하면 될 일이다.
  const desiredMode: DesiredMode = 'any';
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBookSelect = (selectedTitle: string, selectedAuthor: string | null, selectedCover: string | null) => {
    setTitle(selectedTitle);
    setAuthor(selectedAuthor || '');
    setCover(selectedCover);
    setMode('confirm');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('책 제목을 입력해주세요');
      return;
    }

    if (!author.trim()) {
      toast.error('저자를 입력해주세요');
      return;
    }

    setIsSubmitting(true);
    const { error } = await onAdd(title, author || null, notes || null, desiredMode, cover);
    setIsSubmitting(false);

    if (error) {
      toast.error('추가에 실패했습니다', { description: error.message });
    } else {
      toast.success('위시리스트에 추가했어요', {
        description: '이웃들이 어떤 책을 찾고 있는지 볼 수 있습니다.',
      });
      setTitle('');
      setAuthor('');
      setNotes('');
      setCover(null);
      setMode('search');
      onCancel();
    }
  };

  const handleBack = () => {
    if (mode === 'confirm') {
      setMode('search');
    } else if (mode === 'manual') {
      setMode('search');
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={handleSubmit}
      className="bg-card border border-border rounded-2xl p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mode !== 'search' && (
            <button
              type="button"
              onClick={handleBack}
              className="p-1 rounded-lg hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
          <h3 className="font-semibold text-foreground">
            {mode === 'search' && '읽고 싶은 책 요청하기'}
            {mode === 'manual' && '직접 입력'}
            {mode === 'confirm' && '읽고 싶은 책 요청하기'}
          </h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'search' && (
          <motion.div
            key="search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <WishlistBookSearch
              onBookSelect={handleBookSelect}
              onManualEntry={() => setMode('manual')}
            />
          </motion.div>
        )}

        {mode === 'manual' && (
          <motion.div
            key="manual"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <Input
              placeholder="책 제목 *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="bg-muted border-0"
              autoFocus
            />
            <Input
              placeholder="저자 *"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              maxLength={100}
              className="bg-muted border-0"
            />
            <Textarea
              placeholder="요청사항 한마디 (선택)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              className="bg-muted border-0 min-h-[80px] resize-none"
            />
            <Button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="w-full gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              위시리스트에 추가
            </Button>
          </motion.div>
        )}

        {mode === 'confirm' && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="bg-muted rounded-xl p-3">
              <p className="font-medium text-foreground">{title}</p>
            </div>
            <Input
              placeholder="저자 *"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              maxLength={100}
              className="bg-muted border-0"
            />
            <Textarea
              placeholder="요청사항 한마디 (선택)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              className="bg-muted border-0 min-h-[80px] resize-none"
            />
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              위시리스트에 추가
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form>
  );
};
