import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, ArrowLeftRight, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TransactionData {
  id: string;
  type: string;
  status: string;
  created_at: string;
  book_title: string;
  owner_nickname: string;
  borrower_nickname: string;
}

interface ConversationData {
  id: string;
  last_message_at: string;
  participant_1_nickname: string;
  participant_2_nickname: string;
  message_count: number;
}

export const AdminTransactionMonitoring = () => {
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select(`
          id, type, status, created_at,
          book:books(title),
          owner:profiles!transactions_owner_id_fkey(nickname),
          borrower:profiles!transactions_borrower_id_fkey(nickname)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      const formattedTransactions = (txData || []).map((t: any) => ({
        id: t.id,
        type: t.type,
        status: t.status,
        created_at: t.created_at,
        book_title: t.book?.title || '삭제된 도서',
        owner_nickname: t.owner?.nickname || '알 수 없음',
        borrower_nickname: t.borrower?.nickname || '알 수 없음',
      }));

      setTransactions(formattedTransactions);

      // Fetch conversations
      const { data: convData } = await supabase
        .from('conversations')
        .select(`
          id, last_message_at,
          participant_1:profiles!conversations_participant_1_fkey(nickname),
          participant_2:profiles!conversations_participant_2_fkey(nickname)
        `)
        .order('last_message_at', { ascending: false })
        .limit(50);

      // Fetch message counts for each conversation
      const conversationsWithCounts = await Promise.all(
        (convData || []).map(async (conv: any) => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id);

          return {
            id: conv.id,
            last_message_at: conv.last_message_at,
            participant_1_nickname: conv.participant_1?.nickname || '알 수 없음',
            participant_2_nickname: conv.participant_2?.nickname || '알 수 없음',
            message_count: count || 0,
          };
        })
      );

      setConversations(conversationsWithCounts);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(
    (tx) =>
      tx.book_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.owner_nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.borrower_nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      active: 'secondary',
      completed: 'default',
      cancelled: 'destructive',
    };
    const labels: Record<string, string> = {
      pending: '대기중',
      active: '진행중',
      completed: '완료',
      cancelled: '취소',
    };
    return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>;
  };

  // Stats
  const activeTransactions = transactions.filter((t) => t.status === 'active').length;
  const pendingTransactions = transactions.filter((t) => t.status === 'pending').length;
  const completedTransactions = transactions.filter((t) => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{transactions.length}</div>
            <p className="text-sm text-muted-foreground">전체 거래</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-500">{pendingTransactions}</div>
            <p className="text-sm text-muted-foreground">대기중</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{activeTransactions}</div>
            <p className="text-sm text-muted-foreground">진행중</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-500">{completedTransactions}</div>
            <p className="text-sm text-muted-foreground">완료</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            거래 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="도서, 소유자, 대여자로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>도서</TableHead>
                    <TableHead>소유자</TableHead>
                    <TableHead>대여/구매자</TableHead>
                    <TableHead className="text-center">유형</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                    <TableHead>일시</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">{tx.book_title}</TableCell>
                      <TableCell>{tx.owner_nickname}</TableCell>
                      <TableCell>{tx.borrower_nickname}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">
                          {tx.type === 'rent' ? '대여' : '구매'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(tx.status)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(tx.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        검색 결과가 없습니다
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            메시지 현황
            <Badge variant="secondary" className="ml-2">
              {conversations.length}개
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>참여자 1</TableHead>
                    <TableHead>참여자 2</TableHead>
                    <TableHead className="text-center">메시지 수</TableHead>
                    <TableHead>마지막 활동</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversations.map((conv) => (
                    <TableRow key={conv.id}>
                      <TableCell>{conv.participant_1_nickname}</TableCell>
                      <TableCell>{conv.participant_2_nickname}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{conv.message_count}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {conv.last_message_at
                          ? format(new Date(conv.last_message_at), 'yyyy.MM.dd HH:mm', { locale: ko })
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {conversations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        대화가 없습니다
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
