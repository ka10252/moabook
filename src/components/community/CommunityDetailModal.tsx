import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Crown, Trash2, UserMinus, Loader2, Settings, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { MemberProfileModal } from '@/components/profile/MemberProfileModal';
import { EditCommunityModal } from './EditCommunityModal';
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

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile: {
    id: string;
    nickname: string;
    avatar_url: string | null;
  } | null;
}

interface Community {
  id: string;
  name: string;
  description?: string | null;
  cover_url?: string | null;
  created_by?: string | null;
  member_count: number | null;
}

interface CommunityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  community: Community | null;
  onCommunityDeleted?: () => void;
  onCommunityUpdated?: () => void;
}

export const CommunityDetailModal = ({
  isOpen,
  onClose,
  community,
  onCommunityDeleted,
  onCommunityUpdated,
}: CommunityDetailModalProps) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const isOwner = community?.created_by === user?.id;

  useEffect(() => {
    if (isOpen && community) {
      fetchMembers();
    }
  }, [isOpen, community?.id]);

  const fetchMembers = async () => {
    if (!community) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('community_members')
        .select(`
          id,
          user_id,
          role,
          joined_at,
          profile:profiles(id, nickname, avatar_url)
        `)
        .eq('community_id', community.id)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      setMembers((data || []) as Member[]);
    } catch (err) {
      console.error('Failed to fetch members:', err);
      toast.error('멤버 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!confirmRemove || !community) return;

    setRemovingId(confirmRemove.user_id);
    try {
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', community.id)
        .eq('user_id', confirmRemove.user_id);

      if (error) throw error;

      setMembers(prev => prev.filter(m => m.user_id !== confirmRemove.user_id));
      toast.success(`${confirmRemove.profile?.nickname || '멤버'}님을 추방했습니다`);
    } catch (err) {
      console.error('Failed to remove member:', err);
      toast.error('멤버 추방에 실패했습니다');
    } finally {
      setRemovingId(null);
      setConfirmRemove(null);
    }
  };

  const handleDeleteCommunity = async () => {
    if (!community) return;

    setDeleting(true);
    try {
      // First delete all members
      await supabase
        .from('community_members')
        .delete()
        .eq('community_id', community.id);

      // Then delete the community
      const { error } = await supabase
        .from('communities')
        .delete()
        .eq('id', community.id);

      if (error) throw error;

      toast.success('커뮤니티가 삭제되었습니다');
      onClose();
      onCommunityDeleted?.();
    } catch (err) {
      console.error('Failed to delete community:', err);
      toast.error('커뮤니티 삭제에 실패했습니다');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (!isOpen || !community) return null;

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
            className="fixed inset-x-4 top-[10%] bottom-[15%] md:inset-x-auto md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2 z-50"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card rounded-2xl h-full flex flex-col shadow-xl overflow-hidden">
              {/* Header */}
              <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-foreground">{community.name}</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </header>

              {/* Community Info */}
              {community.description && (
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm text-muted-foreground">{community.description}</p>
                </div>
              )}

              {/* Members Header */}
              <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                <span className="text-sm font-medium text-foreground">
                  멤버 ({members.length})
                </span>
                {isOwner && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowEditModal(true)}
                      className="text-primary hover:text-primary hover:bg-primary/10 gap-1"
                    >
                      <Pencil className="w-4 h-4" />
                      수정
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(true)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      삭제
                    </Button>
                  </div>
                )}
              </div>

              {/* Members List */}
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    멤버가 없습니다
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {members.map((member) => {
                      const isMemberOwner = member.user_id === community.created_by;
                      const isCurrentUser = member.user_id === user?.id;

                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedMemberId(member.user_id)}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={member.profile?.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {member.profile?.nickname?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground text-sm">
                                  {member.profile?.nickname || '알 수 없음'}
                                </span>
                                {isMemberOwner && (
                                  <Crown className="w-4 h-4 text-amber-500" />
                                )}
                                {isCurrentUser && (
                                  <span className="text-xs text-primary">(나)</span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground capitalize">
                                {member.role}
                              </span>
                            </div>
                          </div>

                          {/* Remove button - only for owner, not self */}
                          {isOwner && !isMemberOwner && !isCurrentUser && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmRemove(member);
                              }}
                              disabled={removingId === member.user_id}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              {removingId === member.user_id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <UserMinus className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </motion.div>

          {/* Delete Community Confirmation */}
          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent className="rounded-2xl max-w-sm mx-4">
              <AlertDialogHeader>
                <AlertDialogTitle>커뮤니티를 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{community.name}" 커뮤니티와 모든 멤버 정보가 삭제됩니다. 이 작업은 취소할 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteCommunity}
                  disabled={deleting}
                  className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : '삭제'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Remove Member Confirmation */}
          <AlertDialog open={!!confirmRemove} onOpenChange={() => setConfirmRemove(null)}>
            <AlertDialogContent className="rounded-2xl max-w-sm mx-4">
              <AlertDialogHeader>
                <AlertDialogTitle>멤버를 추방하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmRemove?.profile?.nickname || '이 멤버'}님을 커뮤니티에서 추방합니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRemoveMember}
                  className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  추방
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Member Profile Modal */}
          <MemberProfileModal
            isOpen={!!selectedMemberId}
            onClose={() => setSelectedMemberId(null)}
            userId={selectedMemberId}
          />

          {/* Edit Community Modal */}
          <EditCommunityModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            community={community}
            onUpdated={() => {
              onCommunityUpdated?.();
              fetchMembers();
            }}
          />
        </>
      )}
    </AnimatePresence>
  );
};
