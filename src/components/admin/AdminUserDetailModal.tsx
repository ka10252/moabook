import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { X, Loader2, BookOpen, ArrowLeftRight, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface AdminUserDetailModalProps {
  userId: string;
  onClose: () => void;
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

export const AdminUserDetailModal = ({ userId, onClose }: AdminUserDetailModalProps) => {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [books, setBooks] = useState<UserBook[]>([]);
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [communities, setCommunities] = useState<UserCommunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserDetails();
  }, [userId]);

  const fetchUserDetails = async () => {
    setLoading(true);
    try {
      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      setUser(profile);

      // Fetch user's books
      const { data: userBooks } = await supabase
        .from('books')
        .select('id, title, author, status, mode, created_at')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      setBooks(userBooks || []);

      // Fetch user's transactions
      const { data: userTransactions } = await supabase
        .from('transactions')
        .select(`
          id, type, status, created_at,
          book:books(title),
          owner:profiles!transactions_owner_id_fkey(nickname),
          borrower:profiles!transactions_borrower_id_fkey(nickname)
        `)
        .or(`owner_id.eq.${userId},borrower_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      const formattedTransactions = (userTransactions || []).map((t: any) => ({
        id: t.id,
        type: t.type,
        status: t.status,
        created_at: t.created_at,
        book_title: t.book?.title || '삭제된 도서',
        counterparty_nickname: t.owner?.nickname === profile?.nickname 
          ? t.borrower?.nickname 
          : t.owner?.nickname,
        is_owner: t.owner?.nickname === profile?.nickname,
      }));

      setTransactions(formattedTransactions);

      // Fetch user's communities
      const { data: userCommunities } = await supabase
        .from('community_members')
        .select(`
          role, joined_at,
          community:communities(id, name)
        `)
        .eq('user_id', userId)
        .order('joined_at', { ascending: false });

      const formattedCommunities = (userCommunities || [])
        .filter((c: any) => c.community)
        .map((c: any) => ({
          id: c.community.id,
          name: c.community.name,
          role: c.role,
          joined_at: c.joined_at,
        }));

      setCommunities(formattedCommunities);
    } catch (err) {
      console.error('Failed to fetch user details:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      available: 'default',
      rented: 'secondary',
      sold: 'destructive',
      pending: 'outline',
      active: 'secondary',
      completed: 'default',
      cancelled: 'destructive',
    };
    const labels: Record<string, string> = {
      available: '대여가능',
      rented: '대여중',
      sold: '판매완료',
      pending: '대기중',
      active: '진행중',
      completed: '완료',
      cancelled: '취소',
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
        className="w-[calc(100%-2rem)] max-w-2xl h-fit box-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-card rounded-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold">사용자 상세 정보</h2>
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
              <div className="p-4 space-y-6">
                {/* User Profile */}
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="text-xl">{user.nickname[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold">{user.nickname}</h3>
                    {user.bio && <p className="text-sm text-muted-foreground">{user.bio}</p>}
                    <div className="flex gap-2 mt-2">
                      {user.gender && <Badge variant="outline">{user.gender}</Badge>}
                      {user.age && <Badge variant="outline">{user.age}세</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      가입일: {format(new Date(user.created_at), 'yyyy년 MM월 dd일', { locale: ko })}
                    </p>
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
            <div className="p-4 text-center text-muted-foreground">
              사용자 정보를 불러올 수 없습니다
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
