import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface AddWishlistFormProps {
  onAdd: (title: string, author: string | null, notes: string | null) => Promise<{ error: Error | null }>;
  onCancel: () => void;
}

export const AddWishlistForm = ({ onAdd, onCancel }: AddWishlistFormProps) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

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
      onCancel();
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
        <h3 className="font-semibold text-foreground">Add to Wishlist</h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded-lg hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-3">
        <Input
          placeholder="Book title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="bg-muted border-0"
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
      </div>

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
    </motion.form>
  );
};
