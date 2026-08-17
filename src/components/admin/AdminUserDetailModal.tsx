import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { X, Loader2, BookOpen, ArrowLeftRight, Building2, ShieldAlert, ShieldOff, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface AdminUserDetailModalProps {
  userId: string;
  onClose: () => void;
  onRefresh?: () => void;
}

interface UserDetail {
  id: string;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
  gender: string | null;
  age: number | null;
  created_at: string;
}

interface UserBook {
  id: string;
  title: string;
  author: string;
  status: string;
  mode: string;
  created_at: string;
}

interface UserTransaction {
  id: string;
  type: string;
  status: string;
  created_at: string;
  book_title: string;
  counterparty_nickname: string;
  is_owner: boolean;
}

interface UserCommunity {
  id: string;
  name: string;
  role: string;
  joined_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  user: '일반 유저',
  moderator: '모더레이터',
  admin: '관리자',
};

const ROLE_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  user: 'outline',
  moderator: 'secondary',
  admin: 'default',
};

export const AdminUserDetailModal = ({ userId, onClose, onRefresh }: AdminUserDetailModalProps) => {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [books, setBooks] = useState<UserBook[]>([]);
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [communities, setCommunities] = useState<UserCommunity[]>([]);
  const [currentRole, setCurrentRole] = useState<string>('user');
  const [isBanned, setIsBanned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banDuration, setBanDuration] = useState<string>('permanent');

  useEffect(() => {
    fetchUserDetails();
  }, [userId]);

  const fetchUserDetails = async () => {
    setLoading(true);
    try {
      const [
        { data: profile },
        { data: userBooks },
        { data: userTransactions },
        { data: userCommunities },
        { data: roleData },
        { data: authData },
      ] = await Promise.all([
        // gender/age/telegram_chat_id는 base에서 회수됨 → 관리자 전용 RPC로.
        supabase.rpc('admin_get_user' as any, { p_user_id: userId }).single(),
        supabase.from('books').select('id, title, author, status, mode, created_at').eq('owner_id', userId).order('created_at', { ascending: false }),
        supabase.from('transactions').select(`
          id, type, status, created_at,
          book:books(title),
          owner:profiles!transactions_owner_id_fkey(nickname),
          borrower:profiles!transactions_borrower_id_fkey(nickname)
        `).or(`owner_id.eq.${userId},borrower_id.eq.${userId}`).order('created_at', { ascending: false }),
        supabase.from('community_members').select(`role, joined_at, community:communities(id, name)`).eq('user_id', userId).order('joined_at', { ascending: false }),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
        supabase.from('profiles').select('id').eq('id', userId).single(), // placeholder, ban status via RPC
      ]);

      // PostgREST가 관계 임베드를 못 추론하는 응답이라 형태를 우리가 안다고 알려준다
      const prof = profile as unknown as UserDetail;
      setUser(prof);
      setBooks(userBooks || []);
      setCurrentRole(roleData?.role ?? 'user');

      const formattedTransactions = (userTransactions || []).map((t: any) => ({
        id: t.id,
        type: t.type,
        status: t.status,
        created_at: t.created_at,
        book_title: t.book?.title || '삭제된 도서',
        counterparty_nickname:
          t.owner?.nickname === prof?.nickname
            ? t.borrower?.nickname
            : t.owner?.nickname,
        is_owner: t.owner?.nickname === prof?.nickname,
      }));
      setTransactions(formattedTransactions);

      const formattedCommunities = (userCommunities || [])
        .filter((c: any) => c.community)
        .map((c: any) => ({
          id: c.community.id,
          name: c.community.name,
          role: c.role,
          joined_at: c.joined_at,
        }));
      setCommunities(formattedCommunities);

      // Check ban status via admin function
      const { data: banCheck } = await supabase.rpc('admin_check_user_ban' as any, { p_target_user_id: userId });
      if (banCheck) setIsBanned((banCheck as any).is_banned ?? false);
    } catch (err) {
      console.error('Failed to fetch user details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async () => {
    setActionLoading(true);
    try {
      let duration: string | null = null;
      if (banDuration === '7d') duration = '7 days';
      else if (banDuration === '30d') duration = '30 days';
      else if (banDuration === 'permanent') duration = null;

      const { data, error } = await supabase.rpc('admin_ban_user' as any, {
        p_target_user_id: userId,
        p_ban_duration: duration,
      });

      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);

      setIsBanned(true);
      toast.success(`${user?.nickname} 계정이 ${banDuration === 'permanent' ? '영구' : banDuration === '30d' ? '30일' : '7일'} 정지되었습니다`);
      setBanDialogOpen(false);
    } catch (err: any) {
      toast.error('계정 정지에 실패했습니다: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnban = async () => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_unban_user' as any, { p_target_user_id: userId });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);

      setIsBanned(false);
      toast.success(`${user?.nickname} 계정 정지가 해제되었습니다`);
    } catch (err: any) {
      toast.error('정지 해제에 실패했습니다: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_update_user_role' as any, {
        p_target_user_id: userId,
        p_new_role: newRole,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);

      setCurrentRole(newRole);
      toast.success(`${user?.nickname}의 역할이 ${ROLE_LABELS[newRole]}(으)로 변경되었습니다`);
      onRefresh?.();
    } catch (err: any) {
      toast.error('역할 변경에 실패했습니다: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      available: 'default', rented: 'secondary', sold: 'destructive',
      pending: 'outline', active: 'secondary', completed: 'default', cancelled: 'destructive',
    };
    const labels: Record<string, string> = {
      available: '대여가능', rented: '대여중', sold: '판매완료',
      pending: '대기중', active: '진행중', completed: '완료', cancelled: '취소',
    };
    return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>;
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
        className="w-[calc(100%-2rem)] max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-card rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-display text-[20px] font-medium tracking-tight">사용자 상세 정보</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : user ? (
            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-5">
                {/* Profile */}
                <div className="flex items-start gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="text-xl">{user.nickname[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-xl font-medium tracking-tight">{user.nickname}</h3>
                      {isBanned && <Badge variant="destructive">정지됨</Badge>}
                      <Badge variant={ROLE_COLORS[currentRole]}>{ROLE_LABELS[currentRole]}</Badge>
                    </div>
                    {user.bio && <p className="text-sm text-muted-foreground mt-0.5">{user.bio}</p>}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {user.gender && <Badge variant="outline">{user.gender}</Badge>}
                      {user.age && <Badge variant="outline">{user.age}세</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      가입일: {format(new Date(user.created_at), 'yyyy년 MM월 dd일', { locale: ko })}
                    </p>
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/30">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <UserCog className="w-4 h-4" />
                    관리자 액션
                  </p>

                  {/* Role */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-16 shrink-0">역할</span>
                    <Select
                      value={currentRole}
                      onValueChange={handleRoleChange}
                      disabled={actionLoading}
                    >
                      <SelectTrigger className="flex-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">일반 유저</SelectItem>
                        <SelectItem value="moderator">모더레이터</SelectItem>
                        <SelectItem value="admin">관리자</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Ban/Unban */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-16 shrink-0">계정</span>
                    {isBanned ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={handleUnban}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                        정지 해제
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setBanDialogOpen(true)}
                        disabled={actionLoading}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        계정 정지
                      </Button>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="books">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="books" className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      도서 ({books.length})
                    </TabsTrigger>
                    <TabsTrigger value="transactions" className="flex items-center gap-1">
                      <ArrowLeftRight className="w-4 h-4" />
                      거래 ({transactions.length})
                    </TabsTrigger>
                    <TabsTrigger value="communities" className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      커뮤니티 ({communities.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="books" className="mt-4 space-y-2">
                    {books.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">등록된 도서가 없습니다</p>
                    ) : (
                      books.map((book) => (
                        <div key={book.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{book.title}</p>
                            <p className="text-sm text-muted-foreground">{book.author}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{book.mode === 'rent' ? '대여' : '판매'}</Badge>
                            {getStatusBadge(book.status)}
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="transactions" className="mt-4 space-y-2">
                    {transactions.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">거래 내역이 없습니다</p>
                    ) : (
                      transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{tx.book_title}</p>
                            <p className="text-sm text-muted-foreground">
                              {tx.is_owner ? '→' : '←'} {tx.counterparty_nickname}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{tx.type === 'rent' ? '대여' : '구매'}</Badge>
                            {getStatusBadge(tx.status)}
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="communities" className="mt-4 space-y-2">
                    {communities.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">가입한 커뮤니티가 없습니다</p>
                    ) : (
                      communities.map((community) => (
                        <div key={community.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{community.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(community.joined_at), 'yyyy.MM.dd 가입', { locale: ko })}
                            </p>
                          </div>
                          <Badge variant={community.role === 'admin' ? 'default' : 'outline'}>
                            {community.role === 'admin' ? '방장' : '멤버'}
                          </Badge>
                        </div>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
          ) : (
            <div className="p-4 text-center text-muted-foreground">사용자 정보를 불러올 수 없습니다</div>
          )}
        </div>
      </motion.div>

      {/* Ban Confirmation Dialog */}
      <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              계정 정지
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{user?.nickname}</span> 계정을 정지합니다. 정지된 계정은 로그인할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            <p className="text-sm font-medium">정지 기간 선택</p>
            <Select value={banDuration} onValueChange={setBanDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7일</SelectItem>
                <SelectItem value="30d">30일</SelectItem>
                <SelectItem value="permanent">영구 정지</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBan}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '정지 적용'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};
