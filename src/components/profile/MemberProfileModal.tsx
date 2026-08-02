import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Loader2, User, Flag, Ban, ShieldOff, GraduationCap, Handshake } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BookCover } from '@/components/BookCover';
import { ReportModal } from '@/components/report/ReportModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { toast } from 'sonner';
import { Book, transformDbBook } from '@/types/book';
import { BadgeStamp, BADGES, type BadgeId } from '@/components/BadgeStamp';
import { fetchUserBadges, type EarnedBadge } from '@/hooks/useBadges';

interface Profile {
  id: string;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
  gender: string | null;
  age: number | null;
  gender_public: boolean;
  age_public: boolean;
  school: string | null;
  featured_badge: string | null;
  badges_public: boolean;
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
  const { user } = useAuth();
  const { isBlocked, blockUser, unblockUser } = useBlockedUsers();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [completedDeals, setCompletedDeals] = useState<number | null>(null);
  const [memberBadges, setMemberBadges] = useState<EarnedBadge[]>([]);
  const [loading, setLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  const isSelf = user?.id === userId;
  const blocked = userId ? isBlocked(userId) : false;

  const handleToggleBlock = async () => {
    if (!userId) return;
    const { error} = blocked ? await unblockUser(userId) : await blockUser(userId);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(blocked ? '차단을 해제했습니다' : '차단했습니다. 서로의 책과 메시지가 보이지 않습니다.');
    setShowBlockConfirm(false);
    if (!blocked) onClose();
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchProfileAndBooks();
    }
  }, [isOpen, userId]);

  const fetchProfileAndBooks = async () => {
    if (!userId) return;

    setLoading(true);
    setCompletedDeals(null);
    setMemberBadges([]);
    try {
      // Fetch profile
      // 남의 프로필은 profiles_public 뷰로만 본다 — gender/age는 _public일 때만 값이 온다.
      const { data: profileData, error: profileError } = await supabase
        .from('profiles_public' as any)
        .select('id, nickname, avatar_url, bio, gender, age, gender_public, age_public, school, featured_badge, badges_public')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData as Profile);

      // 배지 공개한 유저만 배지 조회(실패해도 프로필은 떠야 함)
      if ((profileData as Profile).badges_public !== false) {
        fetchUserBadges(userId).then(setMemberBadges).catch(() => {});
      }

      // 완료 거래수(신뢰 신호) — 실패해도 프로필은 떠야 하므로 조용히 무시.
      supabase
        .rpc('get_user_public_stats' as any, { p_user_id: userId })
        .then(({ data }) => {
          const deals = (data as { completed_deals?: number } | null)?.completed_deals;
          setCompletedDeals(typeof deals === 'number' ? deals : null);
        });

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
        <motion.div
          key="member-profile-backdrop"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Modal */}
          <motion.div
            key="member-profile-modal"
            className="w-[calc(100%-2rem)] max-w-md h-fit box-border"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
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
                    <h2 className="font-display text-[24px] font-medium tracking-tight text-foreground mt-4 flex items-center justify-center gap-1.5">
                      {profile.nickname}
                      {profile.featured_badge && memberBadges.some((b) => b.badge_key === profile.featured_badge) && (
                        <BadgeStamp
                          id={profile.featured_badge as BadgeId}
                          tier={(memberBadges.find((b) => b.badge_key === profile.featured_badge)?.tier || undefined) as 1 | 2 | 3 | undefined}
                          size={20}
                        />
                      )}
                    </h2>
                    {profile.bio && (
                      <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                        {profile.bio}
                      </p>
                    )}
                    
                    {/* 신뢰 신호 + 성별/나이(공개 시) */}
                    <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                      {profile.school && (
                        <Badge className="text-xs bg-primary/15 text-primary hover:bg-primary/15 border-0 gap-1">
                          <GraduationCap className="w-3 h-3" />
                          {profile.school} 인증
                        </Badge>
                      )}
                      {completedDeals !== null && completedDeals > 0 && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Handshake className="w-3 h-3" />
                          완료 거래 {completedDeals}건
                        </Badge>
                      )}
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

                    {/* 획득 배지 진열 */}
                    {memberBadges.length > 0 && (
                      <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
                        {memberBadges.map((b) => (
                          <span key={b.badge_key} title={BADGES[b.badge_key]?.name}>
                            <BadgeStamp id={b.badge_key} tier={(b.tier || undefined) as 1 | 2 | 3 | undefined} size={26} />
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 신고 / 차단 — 본인 프로필에는 노출하지 않는다 */}
                    {!isSelf && user && (
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowReport(true)}
                          className="rounded-full h-8 text-xs gap-1.5"
                        >
                          <Flag className="w-3.5 h-3.5" />
                          신고
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => (blocked ? handleToggleBlock() : setShowBlockConfirm(true))}
                          className="rounded-full h-8 text-xs gap-1.5"
                        >
                          {blocked ? (
                            <>
                              <ShieldOff className="w-3.5 h-3.5" />
                              차단 해제
                            </>
                          ) : (
                            <>
                              <Ban className="w-3.5 h-3.5" />
                              차단
                            </>
                          )}
                        </Button>
                      </div>
                    )}
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

          <ReportModal
            isOpen={showReport}
            onClose={() => setShowReport(false)}
            targetType="user"
            targetId={userId}
            reportedUserId={userId}
            targetLabel={profile?.nickname}
          />

          <AlertDialog open={showBlockConfirm} onOpenChange={setShowBlockConfirm}>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>{profile?.nickname}님을 차단할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  차단하면 서로의 책이 목록에서 사라지고, 메시지를 주고받을 수 없습니다.
                  언제든 차단을 해제할 수 있습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full">취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleToggleBlock}
                  className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  차단하기
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
