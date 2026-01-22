import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Loader2, X, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { WishlistBookSearch } from './WishlistBookSearch';

interface AddWishlistFormProps {
  onAdd: (title: string, author: string | null, notes: string | null) => Promise<{ error: Error | null }>;
  onCancel: () => void;
}

type FormMode = 'search' | 'manual' | 'confirm';

export const AddWishlistForm = ({ onAdd, onCancel }: AddWishlistFormProps) => {
  const [mode, setMode] = useState<FormMode>('search');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleBookSelect = (selectedTitle: string, selectedAuthor: string | null) => {
    setTitle(selectedTitle);
    setAuthor(selectedAuthor || '');
    setMode('confirm');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a book title.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await onAdd(title, author || null, notes || null);
    setIsSubmitting(false);

    if (error) {
      toast({
        title: 'Failed to add',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Added to wishlist!',
        description: 'Others can now see what you\'re looking for.',
      });
      setTitle('');
      setAuthor('');
      setNotes('');
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
            {mode === 'search' && 'Find a Book'}
            {mode === 'manual' && 'Enter Book Details'}
            {mode === 'confirm' && 'Confirm & Add Notes'}
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
              placeholder="Book title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="bg-muted border-0"
              autoFocus
            />
            <Input
              placeholder="Author (optional)"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              maxLength={100}
              className="bg-muted border-0"
            />
            <Textarea
              placeholder="Notes - why you want it, edition preferences, etc. (optional)"
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
              Add to Wishlist
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
              {author && <p className="text-sm text-muted-foreground">by {author}</p>}
            </div>
            <Textarea
              placeholder="Notes - why you want it, edition preferences, etc. (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              className="bg-muted border-0 min-h-[80px] resize-none"
              autoFocus
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
              Add to Wishlist
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form>
  );
};
