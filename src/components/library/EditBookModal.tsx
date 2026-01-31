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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface EditBookModalProps {
  book: Book | null;
  onClose: () => void;
  onSave: (bookId: string, updates: Partial<Book>) => Promise<{ error: Error | null }>;
}

export const EditBookModal = ({ book, onClose, onSave }: EditBookModalProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    description: '',
    coverUrl: '',
    condition: 'A' as 'S' | 'A' | 'B',
    mode: 'rent' as 'rent' | 'sell',
    price: '',
    isPublic: true,
    communityId: null as string | null,
  });

  // Populate form when book changes
  useEffect(() => {
    if (book) {
      setFormData({
        title: book.title,
        author: book.author,
        description: book.description || '',
        coverUrl: book.cover || '',
        condition: book.condition,
        mode: book.mode,
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
      toast({
        title: 'Missing fields',
        description: 'Title and author are required.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.mode === 'sell' && !formData.price) {
      toast({
        title: 'Price required',
        description: 'Please enter a price for selling.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.isPublic && !formData.communityId) {
      toast({
        title: 'Community required',
        description: 'Please select a community for private listings.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { error } = await onSave(book.id, {
      title: formData.title.trim(),
      author: formData.author.trim(),
      description: formData.description.trim() || null,
      cover: formData.coverUrl || null,
      condition: formData.condition,
      mode: formData.mode,
      price: formData.mode === 'sell' ? parseFloat(formData.price) : null,
      is_public: formData.isPublic,
      community_id: formData.isPublic ? null : formData.communityId,
    });
    setSaving(false);

    if (error) {
      toast({
        title: 'Failed to update',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Book updated!',
        description: 'Your changes have been saved.',
      });
      onClose();
    }
  };

  if (!book) return null;

  return (
    <AnimatePresence>
      {book && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-x-4 top-4 md:inset-x-auto md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 z-50"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={handleSubmit}
              className="bg-card rounded-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl"
            >
              {/* Header */}
              <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <h2 className="text-lg font-bold text-foreground">Edit Book</h2>
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
                    title={formData.title}
                    author={formData.author}
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

                {/* Mode */}
                <ModeToggle
                  value={formData.mode}
                  onChange={(mode) => setFormData(prev => ({ ...prev, mode }))}
                />

                {/* Price (for sell mode) */}
                <AnimatePresence>
                  {formData.mode === 'sell' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      <label className="text-sm font-medium text-foreground">Price ($)</label>
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
        </>
      )}
    </AnimatePresence>
  );
};
