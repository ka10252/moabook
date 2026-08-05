import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Crown, Trash2, UserMinus, Loader2, Pencil, BookOpen, Lock, LayoutList, Link2, Check, Bell, Home, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  kick_count: number;
  is_banned: boolean;
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
  pin_hash?: string;
  member_visibility?: 'public' | 'members_only' | 'private';
}

interface CommunityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  community: Community | null;
  onCommunityDeleted?: () => void;
  onCommunityUpdated?: () => void;
  onNavigateToBookshelf?: (communityId: string) => void;
  onOpenBoard?: (communityId: string, communityName: string) => void;
}

export const CommunityDetailModal = ({
  isOpen,
  onClose,
  community,
  onCommunityDeleted,
  onCommunityUpdated,
  onNavigateToBookshelf,
  onOpenBoard,
}: CommunityDetailModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [banned, setBanned] = useState<{ user_id: string; nickname: string | null; kick_count: number; is_banned: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmKick, setConfirmKick] = useState<Member | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [canViewMembers, setCanViewMembers] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);

  const toggleCommunityNotif = async (next: boolean) => {
    if (!community || !user) return;
    setNotifEnabled(next); // 낙관적 업데이트
    const { error } = await supabase
      .from('community_members')
      .update({ notifications_enabled: next })
      .eq('community_id', community.id)
      .eq('user_id', user.id);
    if (error) {
      setNotifEnabled(!next);
      toast.error('알림 설정을 바꾸지 못했어요');
    }
  };
  const [requiresPin, setRequiresPin] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  const isOwner = community?.created_by === user?.id;

  useEffect(() => {
    if (isOpen && community) {
      checkMembershipAndVisibility();
      if (isOwner) fetchBanned();
    }
  }, [isOpen, community?.id, user?.id, isOwner]);

  // 방장: 방출/차단된 멤버 목록(재가입 허용용)
  const fetchBanned = async () => {
    if (!community) return;
    const { data } = await supabase.rpc('list_banned_members', { p_community_id: community.id });
    setBanned((data ?? []) as typeof banned);
  };

  const handleUnban = async (targetUserId: string) => {
    if (!community) return;
    const { data, error } = await supabase.rpc('unban_community_member', { p_community_id: community.id, p_user_id: targetUserId });
    if (error || data !== 'ok') { toast.error('처리에 실패했어요'); return; }
    toast.success('재가입을 허용했어요');
    setBanned(prev => prev.filter(b => b.user_id !== targetUserId));
  };

  const checkMembershipAndVisibility = async () => {
    if (!community || !user) return;

    // Check if user is a member
    const { data: membership } = await supabase
      .from('community_members')
      .select('id')
      .eq('community_id', community.id)
      .eq('user_id', user.id)
      .maybeSingle();

    const userIsMember = !!membership;
    setIsMember(userIsMember);

    // 알림 설정은 별도로 조회한다. notifications_enabled 컬럼 마이그레이션이 아직 안 됐어도
    // 멤버십 확인(위)이 깨지지 않도록 분리하고, 컬럼이 없으면 기본값(켜짐)으로 둔다.
    if (userIsMember) {
      const { data: notifRow, error: notifErr } = await supabase
        .from('community_members')
        .select('notifications_enabled')
        .eq('community_id', community.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!notifErr && notifRow) {
        setNotifEnabled((notifRow as { notifications_enabled?: boolean }).notifications_enabled ?? true);
      }
    }

    // pin_hash는 더 이상 클라가 읽지 않는다(해시 유출 차단). PIN 필요 여부는 requires_pin 컬럼으로.
    const { data: fullCommunity } = await supabase
      .from('communities')
      .select('requires_pin, member_visibility, invite_token')
      .eq('id', community.id)
      .maybeSingle();

    if (fullCommunity) {
      setRequiresPin(!!(fullCommunity as any).requires_pin);
      setInviteToken((fullCommunity as any).invite_token ?? null);
      const visibility = fullCommunity.member_visibility as 'public' | 'members_only' | 'private';
      
      // Determine if user can view members
      if (visibility === 'public') {
        setCanViewMembers(true);
      } else if (visibility === 'members_only') {
        setCanViewMembers(isOwner || userIsMember);
      } else { // private
        setCanViewMembers(isOwner);
      }
    }

    if (isOwner || userIsMember) {
      fetchMembers();
    }
  };

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
          kick_count,
          is_banned,
          profile:profiles(id, nickname, avatar_url)
        `)
        .eq('community_id', community.id)
        .eq('is_banned', false)
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

  const handleKickMember = async () => {
    if (!confirmKick || !community) return;

    setRemovingId(confirmKick.user_id);
    try {
      // 방출 카운트는 멤버십 행이 삭제돼도 살아남는 flags 테이블에 서버측으로 기록된다(3회=영구차단).
      const { data: result, error } = await supabase.rpc('kick_community_member', {
        p_community_id: community.id,
        p_user_id: confirmKick.user_id,
        p_ban: false,
      });
      if (error) throw error;

      if (result === 'banned') {
        toast.success(`${confirmKick.profile?.nickname || '멤버'}님이 영구 방출되었습니다 (3회 이상 방출)`);
      } else if (result === 'kicked') {
        const n = (confirmKick.kick_count || 0) + 1;
        toast.success(`${confirmKick.profile?.nickname || '멤버'}님을 방출했습니다 (${n}/3)`);
      } else {
        toast.error('멤버 방출 권한이 없습니다');
        return;
      }

      setMembers(prev => prev.filter(m => m.user_id !== confirmKick.user_id));
    } catch (err) {
      console.error('Failed to kick member:', err);
      toast.error('멤버 방출에 실패했습니다');
    } finally {
      setRemovingId(null);
      setConfirmKick(null);
    }
  };

  // 멤버 본인이 커뮤니티에서 나가기 (방장은 나가기 대신 삭제/양도)
  const handleLeaveCommunity = async () => {
    if (!community || !user) return;
    setLeaving(true);
    try {
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', community.id)
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('커뮤니티에서 나왔어요');
      onClose();
      onCommunityUpdated?.();
    } catch (err) {
      console.error('Failed to leave community:', err);
      toast.error('나가기에 실패했습니다');
    } finally {
      setLeaving(false);
      setConfirmLeave(false);
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

  const handleCopyInviteLink = async () => {
    if (!community) return;
    setInviteLoading(true);
    let token = inviteToken;
    if (!token) {
      // Generate a new token and save it
      token = Array.from(crypto.getRandomValues(new Uint8Array(6)))
        .map(b => b.toString(36).padStart(2, '0'))
        .join('')
        .toUpperCase()
        .slice(0, 8);
      const { error } = await supabase
        .from('communities')
        .update({ invite_token: token } as any)
        .eq('id', community.id);
      if (error) { toast.error('초대 링크 생성에 실패했습니다'); setInviteLoading(false); return; }
      setInviteToken(token);
    }
    const url = `${window.location.origin}/?invite=${token}`;
    await navigator.clipboard.writeText(url);
    setInviteCopied(true);
    toast.success('초대 링크가 복사됐어요!');
    setTimeout(() => setInviteCopied(false), 2500);
    setInviteLoading(false);
  };

  const handleNavigateToBookshelf = () => {
    if (!community) return;

    // If public (no PIN) or user is member, navigate directly
    if (!requiresPin || isMember || isOwner) {
      onClose();
      onNavigateToBookshelf?.(community.id);
    } else {
      // Show PIN dialog
      setShowPinDialog(true);
      setPinInput('');
      setPinError(false);
    }
  };

  const handlePinSubmit = async () => {
    if (!community) return;
    // 서버측 검증(bcrypt) — 해시를 클라로 가져오지 않는다.
    const { data: ok, error } = await supabase.rpc('verify_community_pin', {
      p_community_id: community.id,
      p_pin: pinInput,
    });
    if (!error && ok) {
      setShowPinDialog(false);
      onClose();
      onNavigateToBookshelf?.(community.id);
    } else {
      setPinError(true);
      toast.error('잘못된 비밀번호입니다');
    }
  };

  if (!isOpen || !community) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="community-detail-backdrop"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Modal */}
          <motion.div
            key="community-detail-modal"
            className="w-[calc(100%-2rem)] max-w-md h-fit box-border"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card rounded-2xl flex flex-col shadow-xl overflow-hidden max-h-[80vh]">
              {/* Hero — 커뮤니티 정체성 (커버 있으면 배경, 없으면 코랄 그라데이션) */}
              <div
                className="relative shrink-0 px-5 pt-5 pb-4 text-primary-foreground bg-gradient-to-br from-primary to-primary/70"
                style={
                  community.cover_url
                    ? {
                        backgroundImage: `linear-gradient(to bottom right, rgba(20,12,8,.35), rgba(20,12,8,.55)), url(${community.cover_url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : undefined
                }
              >
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/20 transition-colors text-primary-foreground/90"
                  aria-label="닫기"
                >
                  <X className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold tracking-tight pr-8 truncate">{community.name}</h2>
                <p className="text-xs opacity-90 mt-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  멤버 {community.member_count ?? members.length}명
                  {isOwner ? ' · 내가 방장' : isMember ? ' · 멤버' : ''}
                </p>
                {community.description && (
                  <p className="text-xs opacity-90 mt-2.5 leading-relaxed line-clamp-2">{community.description}</p>
                )}
              </div>

              {/* 액션 타일 — 책장 · 게시판 · 커뮤니티룸(최우측). flex-1로 개수에 맞춰 자동 정렬 */}
              <div className="px-4 pt-4 pb-1 shrink-0">
                <div className="flex gap-2">
                  <button
                    onClick={handleNavigateToBookshelf}
                    className="flex-1 flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-muted/60 hover:bg-muted transition-colors relative"
                  >
                    <BookOpen className="w-[22px] h-[22px] text-primary" />
                    <span className="text-xs font-medium text-foreground">책장</span>
                    {requiresPin && !isMember && !isOwner && (
                      <Lock className="w-3 h-3 text-muted-foreground absolute top-2 right-2" />
                    )}
                  </button>
                  {(isMember || isOwner) && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenBoard?.(community.id, community.name);
                      }}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-muted/60 hover:bg-muted transition-colors"
                    >
                      <LayoutList className="w-[22px] h-[22px] text-primary" />
                      <span className="text-xs font-medium text-foreground">게시판</span>
                    </button>
                  )}
                  {(isMember || isOwner) && (
                    <button
                      onClick={() => {
                        onClose();
                        navigate(`/space/community/${community.id}`);
                      }}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-muted/60 hover:bg-muted transition-colors"
                    >
                      <Home className="w-[22px] h-[22px] text-primary" />
                      <span className="text-xs font-medium text-foreground">커뮤니티룸</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 이 커뮤니티 알림 토글 — 멤버만 */}
              {(isMember || isOwner) && (
                <div className="px-4 py-3 shrink-0 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">이 커뮤니티 새 책 알림</span>
                  </div>
                  <Switch checked={notifEnabled} onCheckedChange={toggleCommunityNotif} />
                </div>
              )}

              {/* Members Header */}
              <div className="px-4 py-3 flex items-center justify-between border-y border-border shrink-0">
                <span className="text-sm font-medium text-foreground">
                  멤버 ({members.length})
                </span>
                {isOwner && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyInviteLink}
                      disabled={inviteLoading}
                      className="text-primary hover:text-primary hover:bg-primary/10 gap-1 h-8 px-2"
                    >
                      {inviteLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : inviteCopied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">{inviteCopied ? '복사됨' : '초대'}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowEditModal(true)}
                      className="text-primary hover:text-primary hover:bg-primary/10 gap-1 h-8 px-2"
                    >
                      <Pencil className="w-4 h-4" />
                      <span className="hidden sm:inline">수정</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(true)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 h-8 px-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">삭제</span>
                    </Button>
                  </div>
                )}
                {/* 멤버 본인 나가기 (방장 제외) */}
                {isMember && !isOwner && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmLeave(true)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 h-8 px-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>나가기</span>
                  </Button>
                )}
              </div>

              {/* Members List — 헤더/액션은 고정(shrink-0), 이 영역만 스크롤.
                  radix ScrollArea가 모바일에서 스크롤이 안 먹던 문제 → 네이티브 overflow로 교체(B3) */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                {!canViewMembers ? (
                  <div className="text-center py-12 text-muted-foreground px-4">
                    <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>멤버 목록을 볼 수 없습니다</p>
                    <p className="text-xs mt-1">커뮤니티에 가입하면 볼 수 있습니다</p>
                  </div>
                ) : loading ? (
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
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Avatar className="w-10 h-10 shrink-0">
                              <AvatarImage src={member.profile?.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {member.profile?.nickname?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground text-sm truncate">
                                  {member.profile?.nickname || '알 수 없음'}
                                </span>
                                {isMemberOwner && (
                                  <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                                )}
                                {isCurrentUser && (
                                  <span className="text-xs text-primary shrink-0">(나)</span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground capitalize">
                                {member.role}
                              </span>
                            </div>
                          </div>

                          {/* Kick button - only for owner, not self */}
                          {isOwner && !isMemberOwner && !isCurrentUser && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmKick(member);
                              }}
                              disabled={removingId === member.user_id}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
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

                {/* 방장: 방출·차단된 멤버 재가입 허용 */}
                {isOwner && banned.length > 0 && (
                  <div className="px-4 py-3 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">방출·차단된 멤버</p>
                    <div className="space-y-2">
                      {banned.map((b) => (
                        <div key={b.user_id} className="flex items-center justify-between">
                          <div className="min-w-0">
                            <span className="text-sm text-foreground">{b.nickname || '알 수 없음'}</span>
                            <span className="ml-2 text-[11px] text-muted-foreground">
                              {b.is_banned ? '영구 차단' : `방출 ${b.kick_count}회`}
                            </span>
                          </div>
                          <Button size="sm" variant="outline" className="rounded-full text-xs shrink-0" onClick={() => handleUnban(b.user_id)}>
                            재가입 허용
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Delete Community Confirmation */}
          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent className="rounded-2xl max-w-[90vw] md:max-w-sm mx-4 z-[60]">
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

          {/* Leave Community Confirmation */}
          <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
            <AlertDialogContent className="rounded-2xl max-w-[90vw] md:max-w-sm mx-4 z-[60]">
              <AlertDialogHeader>
                <AlertDialogTitle>커뮤니티에서 나가시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{community.name}"에서 나갑니다. 다시 들어오려면 PIN으로 재가입해야 해요.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLeaveCommunity}
                  disabled={leaving}
                  className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {leaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '나가기'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Kick Member Confirmation */}
          <AlertDialog open={!!confirmKick} onOpenChange={() => setConfirmKick(null)}>
            <AlertDialogContent className="rounded-2xl max-w-[90vw] md:max-w-sm mx-4 z-[60]">
              <AlertDialogHeader>
                <AlertDialogTitle>멤버를 방출하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmKick?.profile?.nickname || '이 멤버'}님을 커뮤니티에서 방출합니다.
                  {confirmKick && (confirmKick.kick_count || 0) >= 2 && (
                    <span className="block mt-2 text-destructive font-medium">
                      ⚠️ 3회 방출 시 영구 차단됩니다!
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleKickMember}
                  className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  방출
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* PIN Dialog */}
          <AlertDialog open={showPinDialog} onOpenChange={setShowPinDialog}>
            <AlertDialogContent className="rounded-2xl max-w-[90vw] md:max-w-sm mx-4 z-[60]">
              <AlertDialogHeader>
                <AlertDialogTitle>비밀번호 입력</AlertDialogTitle>
                <AlertDialogDescription>
                  비공개 커뮤니티입니다. 4자리 비밀번호를 입력해주세요.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex justify-center py-4">
                <InputOTP
                  value={pinInput}
                  onChange={(value) => {
                    setPinInput(value);
                    setPinError(false);
                  }}
                  maxLength={4}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className={`w-12 h-12 text-lg ${pinError ? 'border-destructive' : ''}`} />
                    <InputOTPSlot index={1} className={`w-12 h-12 text-lg ${pinError ? 'border-destructive' : ''}`} />
                    <InputOTPSlot index={2} className={`w-12 h-12 text-lg ${pinError ? 'border-destructive' : ''}`} />
                    <InputOTPSlot index={3} className={`w-12 h-12 text-lg ${pinError ? 'border-destructive' : ''}`} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handlePinSubmit}
                  disabled={pinInput.length !== 4}
                  className="rounded-xl"
                >
                  확인
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
        </motion.div>
      )}

    </AnimatePresence>
  );
};
