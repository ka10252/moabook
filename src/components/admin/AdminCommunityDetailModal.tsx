import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { X, Loader2, Users, Ban, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';

interface AdminCommunityDetailModalProps {
  communityId: string;
  onClose: () => void;
  onRefresh: () => void;
}

interface CommunityDetail {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  created_at: string;
  creator_nickname: string;
}

interface CommunityMember {
  id: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  role: string;
  joined_at: string;
  kick_count: number;
  is_banned: boolean;
}

export const AdminCommunityDetailModal = ({
  communityId,
  onClose,
  onRefresh,
}: AdminCommunityDetailModalProps) => {
  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [bannedMembers, setBannedMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommunityDetails();
  }, [communityId]);

  const fetchCommunityDetails = async () => {
    setLoading(true);
    try {
      // Fetch community info
      const { data: communityData } = await supabase
        .from('communities')
        .select(`
          id, name, description, member_count, created_at,
          creator:profiles!communities_created_by_fkey(nickname)
        `)
        .eq('id', communityId)
        .single();

      if (communityData) {
        setCommunity({
          id: communityData.id,
          name: communityData.name,
          description: communityData.description,
          member_count: communityData.member_count || 0,
          created_at: communityData.created_at,
          creator_nickname: (communityData.creator as any)?.nickname || '알 수 없음',
        });
      }

      // Fetch all members (including banned)
      const { data: membersData } = await supabase
        .from('community_members')
        .select(`
          id, user_id, role, joined_at, kick_count, is_banned,
          profile:profiles!community_members_user_id_fkey(nickname, avatar_url)
        `)
        .eq('community_id', communityId)
        .order('joined_at', { ascending: false });

      const formattedMembers = (membersData || []).map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        nickname: m.profile?.nickname || '알 수 없음',
        avatar_url: m.profile?.avatar_url,
        role: m.role,
        joined_at: m.joined_at,
        kick_count: m.kick_count,
        is_banned: m.is_banned,
      }));

      setMembers(formattedMembers.filter((m) => !m.is_banned));
      setBannedMembers(formattedMembers.filter((m) => m.is_banned));
    } catch (err) {
      console.error('Failed to fetch community details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('community_members')
        .update({ is_banned: false, kick_count: 0 })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('차단이 해제되었습니다');
      fetchCommunityDetails();
      onRefresh();
    } catch (err) {
      console.error('Failed to unban member:', err);
      toast.error('차단 해제에 실패했습니다');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success('멤버가 제거되었습니다');
      fetchCommunityDetails();
      onRefresh();
    } catch (err) {
      console.error('Failed to remove member:', err);
      toast.error('멤버 제거에 실패했습니다');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-[calc(100%-2rem)] max-w-2xl h-fit box-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-card rounded-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold">커뮤니티 상세 정보</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : community ? (
            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-6">
                {/* Community Info */}
                <div>
                  <h3 className="text-lg font-semibold">{community.name}</h3>
                  {community.description && (
                    <p className="text-sm text-muted-foreground mt-1">{community.description}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline">방장: {community.creator_nickname}</Badge>
                    <Badge variant="secondary">{community.member_count}명</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    생성일: {format(new Date(community.created_at), 'yyyy년 MM월 dd일', { locale: ko })}
                  </p>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="members">
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="members" className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      멤버 ({members.length})
                    </TabsTrigger>
                    <TabsTrigger value="banned" className="flex items-center gap-1">
                      <Ban className="w-4 h-4" />
                      차단 ({bannedMembers.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="members" className="mt-4 space-y-2">
                    {members.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">멤버가 없습니다</p>
                    ) : (
                      members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={member.avatar_url || undefined} />
                              <AvatarFallback>{member.nickname[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{member.nickname}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(member.joined_at), 'yyyy.MM.dd 가입', { locale: ko })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={member.role === 'admin' ? 'default' : 'outline'}>
                              {member.role === 'admin' ? '방장' : '멤버'}
                            </Badge>
                            {member.kick_count > 0 && (
                              <Badge variant="secondary">퇴장 {member.kick_count}회</Badge>
                            )}
                            {member.role !== 'admin' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleRemoveMember(member.id)}
                              >
                                <UserMinus className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="banned" className="mt-4 space-y-2">
                    {bannedMembers.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">차단된 멤버가 없습니다</p>
                    ) : (
                      bannedMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={member.avatar_url || undefined} />
                              <AvatarFallback>{member.nickname[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{member.nickname}</p>
                              <p className="text-xs text-muted-foreground">
                                퇴장 {member.kick_count}회로 영구 차단
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnban(member.id)}
                          >
                            차단 해제
                          </Button>
                        </div>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              커뮤니티 정보를 불러올 수 없습니다
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
