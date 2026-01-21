import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Loader2, ImagePlus } from 'lucide-react';
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

  useEffect(() => {
    const fillBookDetails = async () => {
      if (!selectedBook) return;
      
      setIsFetchingDetails(true);
      
      // Fetch description from Open Library
      const description = await fetchBookDetails(selectedBook.key);
      
      setFormData((prev) => ({
        ...prev,
        title: selectedBook.title,
        author: selectedBook.author,
        coverUrl: selectedBook.cover || '',
        description: description || prev.description,
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
      const { error } = await supabase.from('books').insert({
        title: formData.title.trim(),
        author: formData.author.trim(),
        description: formData.description.trim() || null,
        cover_url: formData.coverUrl || null,
        condition: formData.condition,
        mode: formData.mode,
        price: formData.mode === 'sell' ? parseFloat(formData.price) : null,
        is_public: formData.isPublic,
        community_id: formData.communityId,
        owner_id: user.id,
      });

      if (error) throw error;

      toast.success('Book uploaded successfully!');
      
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
      toast.error('Failed to upload book. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Book Search */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Find Your Book</label>
        <BookSearchInput
          selectedBook={selectedBook}
          onBookSelect={setSelectedBook}
          onClear={handleClearBook}
        />
        {isFetchingDetails && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Fetching book details...
          </p>
        )}
      </div>

      {/* Cover Preview */}
      {formData.coverUrl && (
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
            <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground p-1.5 rounded-full">
              <ImagePlus className="w-4 h-4" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Manual Entry Fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Title</label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Book title"
            className="h-12 bg-secondary border-border rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Author</label>
          <Input
            value={formData.author}
            onChange={(e) => setFormData((prev) => ({ ...prev, author: e.target.value }))}
            placeholder="Author name"
            className="h-12 bg-secondary border-border rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Description (optional)</label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of the book..."
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
      {formData.mode === 'sell' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-2"
        >
          <label className="text-sm font-medium text-foreground">Price (€)</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={formData.price}
            onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
            placeholder="0.00"
            className="h-12 bg-secondary border-border rounded-xl"
          />
        </motion.div>
      )}

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
            Uploading...
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 mr-2" />
            Upload Book
          </>
        )}
      </Button>
    </form>
  );
};
