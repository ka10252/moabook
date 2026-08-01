import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Eye, Loader2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AdminUserDetailModal } from './AdminUserDetailModal';

interface UserProfile {
  id: string;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
  gender: string | null;
  age: number | null;
  created_at: string;
  community_count: number;
  book_count: number;
  transaction_count: number;
}

export const AdminUserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [
        { data: profiles },
        { data: communityCounts },
        { data: bookCounts },
        { data: transactionCounts },
      ] = await Promise.all([
        // gender/age/telegram_chat_id는 base에서 회수됨 → 관리자 전용 RPC로 전체 조회.
        supabase.rpc('admin_list_users' as any),
        supabase.from('community_members').select('user_id').eq('is_banned', false),
        supabase.from('books').select('owner_id'),
        supabase.from('transactions').select('owner_id, borrower_id'),
      ]);

      const communityMap: Record<string, number> = {};
      (communityCounts || []).forEach(({ user_id }) => { communityMap[user_id] = (communityMap[user_id] ?? 0) + 1; });

      const bookMap: Record<string, number> = {};
      (bookCounts || []).forEach(({ owner_id }) => { bookMap[owner_id] = (bookMap[owner_id] ?? 0) + 1; });

      const txMap: Record<string, number> = {};
      (transactionCounts || []).forEach(({ owner_id, borrower_id }) => {
        txMap[owner_id] = (txMap[owner_id] ?? 0) + 1;
        if (borrower_id && borrower_id !== owner_id) txMap[borrower_id] = (txMap[borrower_id] ?? 0) + 1;
      });

      setUsers((profiles || []).map((p) => ({
        ...p,
        community_count: communityMap[p.id] ?? 0,
        book_count: bookMap[p.id] ?? 0,
        transaction_count: txMap[p.id] ?? 0,
      })));
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (u) => u.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.bio?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl font-medium tracking-tight flex items-center gap-2">
          <Users className="w-5 h-5" />
          사용자 관리
          <Badge variant="secondary" className="ml-2">{users.length}명</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="닉네임 또는 소개글로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">검색 결과가 없습니다</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 pb-3 font-medium">사용자</th>
                    <th className="text-center py-2 pb-3 font-medium">커뮤니티</th>
                    <th className="text-center py-2 pb-3 font-medium">도서</th>
                    <th className="text-center py-2 pb-3 font-medium">거래</th>
                    <th className="text-left py-2 pb-3 font-medium">가입일</th>
                    <th className="text-right py-2 pb-3 font-medium">상세</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback>{user.nickname[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.nickname}</p>
                            {user.bio && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{user.bio}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-center"><Badge variant="outline">{user.community_count}</Badge></td>
                      <td className="py-3 text-center"><Badge variant="outline">{user.book_count}</Badge></td>
                      <td className="py-3 text-center"><Badge variant="outline">{user.transaction_count}</Badge></td>
                      <td className="py-3 text-muted-foreground">{format(new Date(user.created_at), 'yyyy.MM.dd', { locale: ko })}</td>
                      <td className="py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(user.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border"
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>{user.nickname[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{user.nickname}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">도서 {user.book_count}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">거래 {user.transaction_count}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(user.created_at), 'yy.MM.dd', { locale: ko })}</span>
                    </div>
                  </div>
                  <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>

      {selectedUserId && (
        <AdminUserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onRefresh={fetchUsers}
        />
      )}
    </Card>
  );
};
