import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Loader2, X, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { WishlistBookSearch } from './WishlistBookSearch';

interface AddWishlistFormProps {
  onAdd: (title: string, author: string | null, notes: string | null, desiredMode: 'rent' | 'buy' | 'any', coverUrl: string | null) => Promise<{ error: Error | null }>;
  onCancel: () => void;
}

type FormMode = 'search' | 'manual' | 'confirm';
type DesiredMode = 'rent' | 'buy' | 'any';

const DESIRED_OPTIONS: { id: DesiredMode; label: string }[] = [
  { id: 'rent', label: '빌리고 싶어요' },
  { id: 'buy', label: '사고 싶어요' },
  { id: 'any', label: '상관없어요' },
];

export const AddWishlistForm = ({ onAdd, onCancel }: AddWishlistFormProps) => {
  const [mode, setMode] = useState<FormMode>('search');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [notes, setNotes] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const [desiredMode, setDesiredMode] = useState<DesiredMode>('any');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const DesiredSelect = () => (
    <div>
      <p className="text-[12px] font-medium text-muted-foreground mb-1.5">이 책을</p>
      <div className="flex gap-2">
        {DESIRED_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setDesiredMode(o.id)}
            className={`flex-1 h-9 rounded-lg text-[13px] font-medium border transition-colors ${
              desiredMode === o.id ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  const handleBookSelect = (selectedTitle: string, selectedAuthor: string | null, selectedCover: string | null) => {
    setTitle(selectedTitle);
    setAuthor(selectedAuthor || '');
    setCover(selectedCover);
    setMode('confirm');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: '책 제목을 입력해주세요',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await onAdd(title, author || null, notes || null, desiredMode, cover);
    setIsSubmitting(false);

    if (error) {
      toast({
        title: '추가에 실패했습니다',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: '위시리스트에 추가했어요',
        description: '이웃들이 어떤 책을 찾고 있는지 볼 수 있습니다.',
      });
      setTitle('');
      setAuthor('');
      setNotes('');
      setCover(null);
      setDesiredMode('any');
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
            {mode === 'search' && '책 찾기'}
            {mode === 'manual' && '직접 입력'}
            {mode === 'confirm' && '한마디 남기기'}
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
              placeholder="저자 (선택)"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              maxLength={100}
              className="bg-muted border-0"
            />
            <Textarea
              placeholder="이웃에게 한마디 — 왜 찾고 있는지, 어떤 판본이면 좋은지 (선택)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              className="bg-muted border-0 min-h-[80px] resize-none"
            />
            <DesiredSelect />
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
            <div className="bg-muted rounded-xl p-3 space-y-1">
              <p className="font-medium text-foreground">{title}</p>
              {author && <p className="text-sm text-muted-foreground">{author}</p>}
            </div>
            <Textarea
              placeholder="이웃에게 한마디 — 왜 찾고 있는지, 어떤 판본이면 좋은지 (선택)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              className="bg-muted border-0 min-h-[80px] resize-none"
              autoFocus
            />
            <DesiredSelect />
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
