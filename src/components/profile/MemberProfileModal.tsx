import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Loader2, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { BookCover } from '@/components/BookCover';
import { supabase } from '@/integrations/supabase/client';
import { Book, transformDbBook } from '@/types/book';

interface Profile {
  id: string;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
  gender: string | null;
  age: number | null;
  gender_public: boolean;
  age_public: boolean;
}

interface MemberProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  onBookClick?: (book: Book) => void;
}

export const MemberProfileModal = ({
  isOpen,
  onClose,
  userId,
  onBookClick,
}: MemberProfileModalProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      fetchProfileAndBooks();
    }
  }, [isOpen, userId]);

  const fetchProfileAndBooks = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url, bio, gender, age, gender_public, age_public')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData as Profile);

      // Fetch user's books (public or owned by them)
      const { data: booksData, error: booksError } = await supabase
        .from('books')
        .select(`
          *,
          profile:profiles!books_owner_id_fkey(nickname),
          community:communities(name)
        `)
        .eq('owner_id', userId)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (booksError) throw booksError;
      setBooks((booksData || []).map(transformDbBook));
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const getGenderLabel = (gender: string | null) => {
    switch (gender) {
      case 'male': return '남성';
      case 'female': return '여성';
      case 'other': return '기타';
      default: return null;
    }
  };

  if (!isOpen || !userId) return null;

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="fixed inset-x-4 top-4 md:inset-x-auto md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2 z-50"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card rounded-2xl max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 z-10 p-2 rounded-xl bg-black/20 hover:bg-black/40 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : profile ? (
                <>
                  {/* Profile Header */}
                  <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-6 text-center">
                    <Avatar className="w-24 h-24 mx-auto border-4 border-background shadow-lg">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                        {profile.nickname?.charAt(0) || <User className="w-10 h-10" />}
                      </AvatarFallback>
                    </Avatar>
                    <h2 className="text-xl font-bold text-foreground mt-4">
                      {profile.nickname}
                    </h2>
                    {profile.bio && (
                      <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                        {profile.bio}
                      </p>
                    )}
                    
                    {/* Gender & Age (if public) */}
                    <div className="flex items-center justify-center gap-2 mt-3">
                      {profile.gender_public && profile.gender && (
                        <Badge variant="secondary" className="text-xs">
                          {getGenderLabel(profile.gender)}
                        </Badge>
                      )}
                      {profile.age_public && profile.age && (
                        <Badge variant="secondary" className="text-xs">
                          {profile.age}세
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Books Section */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">
                        {profile.nickname}님의 책장 ({books.length})
                      </span>
                    </div>

                    <ScrollArea className="flex-1">
                      {books.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p className="text-sm">아직 등록한 책이 없습니다</p>
                        </div>
                      ) : (
                        <div className="p-4 grid grid-cols-2 gap-4">
                          {books.map((book) => (
                            <BookCover
                              key={book.id}
                              book={book}
                              onClick={() => {
                                onBookClick?.(book);
                                onClose();
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  프로필을 찾을 수 없습니다
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
