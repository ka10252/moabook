import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, ArrowLeftRight, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, subDays, startOfDay } from 'date-fns';
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

const DATE_OPTIONS = [
  { label: '전체', value: 'all' },
  { label: '오늘', value: '1' },
  { label: '최근 7일', value: '7' },
  { label: '최근 30일', value: '30' },
  { label: '최근 90일', value: '90' },
];

export const AdminTransactionMonitoring = () => {
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Transactions — single query with joins
      const { data: txData } = await supabase
        .from('transactions')
        .select(`
          id, type, status, created_at,
          book:books(title),
          owner:profiles!transactions_owner_id_fkey(nickname),
          borrower:profiles!transactions_borrower_id_fkey(nickname)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      setTransactions(
        (txData || []).map((t: any) => ({
          id: t.id,
          type: t.type,
          status: t.status,
          created_at: t.created_at,
          book_title: t.book?.title || '삭제된 도서',
          owner_nickname: t.owner?.nickname || '알 수 없음',
          borrower_nickname: t.borrower?.nickname || '알 수 없음',
        }))
      );

      // Conversations + message counts — 2 queries instead of N+1
      const [{ data: convData }, { data: msgCounts }] = await Promise.all([
        supabase
          .from('conversations')
          .select(`
            id, last_message_at,
            participant_1:profiles!conversations_participant_1_fkey(nickname),
            participant_2:profiles!conversations_participant_2_fkey(nickname)
          `)
          .order('last_message_at', { ascending: false })
          .limit(200),
        supabase.from('messages').select('conversation_id'),
      ]);

      const msgMap: Record<string, number> = {};
      (msgCounts || []).forEach(({ conversation_id }) => {
        msgMap[conversation_id] = (msgMap[conversation_id] ?? 0) + 1;
      });

      setConversations(
        (convData || []).map((c: any) => ({
          id: c.id,
          last_message_at: c.last_message_at,
          participant_1_nickname: c.participant_1?.nickname || '알 수 없음',
          participant_2_nickname: c.participant_2?.nickname || '알 수 없음',
          message_count: msgMap[c.id] ?? 0,
        }))
      );
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (dateFilter !== 'all') {
      const cutoff = startOfDay(subDays(new Date(), parseInt(dateFilter) - 1));
      if (new Date(tx.created_at) < cutoff) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !tx.book_title.toLowerCase().includes(q) &&
        !tx.owner_nickname.toLowerCase().includes(q) &&
        !tx.borrower_nickname.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const hasActiveFilters = statusFilter !== 'all' || typeFilter !== 'all' || dateFilter !== 'all' || searchQuery;

  const clearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setDateFilter('all');
    setSearchQuery('');
  };

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

  const activeCount = transactions.filter((t) => t.status === 'active').length;
  const pendingCount = transactions.filter((t) => t.status === 'pending').length;
  const completedCount = transactions.filter((t) => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{transactions.length}</div>
            <p className="text-sm text-muted-foreground">전체 거래</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-500">{pendingCount}</div>
            <p className="text-sm text-muted-foreground">대기중</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{activeCount}</div>
            <p className="text-sm text-muted-foreground">진행중</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-500">{completedCount}</div>
            <p className="text-sm text-muted-foreground">완료</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            거래 현황
            {filteredTransactions.length !== transactions.length && (
              <Badge variant="secondary" className="ml-1">
                {filteredTransactions.length} / {transactions.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="도서, 소유자, 대여자..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[110px]">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="pending">대기중</SelectItem>
                <SelectItem value="active">진행중</SelectItem>
                <SelectItem value="completed">완료</SelectItem>
                <SelectItem value="cancelled">취소</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="유형" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 유형</SelectItem>
                <SelectItem value="rent">대여</SelectItem>
                <SelectItem value="purchase">구매</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[110px]">
                <SelectValue placeholder="기간" />
              </SelectTrigger>
              <SelectContent>
                {DATE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                <X className="w-3 h-3" />
                초기화
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {hasActiveFilters ? '필터 조건에 맞는 거래가 없습니다' : '거래가 없습니다'}
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 pb-3 font-medium">도서</th>
                      <th className="text-left py-2 pb-3 font-medium">소유자</th>
                      <th className="text-left py-2 pb-3 font-medium">대여/구매자</th>
                      <th className="text-center py-2 pb-3 font-medium">유형</th>
                      <th className="text-center py-2 pb-3 font-medium">상태</th>
                      <th className="text-left py-2 pb-3 font-medium">일시</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4 font-medium">{tx.book_title}</td>
                        <td className="py-3 pr-4">{tx.owner_nickname}</td>
                        <td className="py-3 pr-4">{tx.borrower_nickname}</td>
                        <td className="py-3 text-center">
                          <Badge variant="outline">{tx.type === 'rent' ? '대여' : '구매'}</Badge>
                        </td>
                        <td className="py-3 text-center">{getStatusBadge(tx.status)}</td>
                        <td className="py-3 text-muted-foreground">
                          {format(new Date(tx.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {filteredTransactions.map((tx) => (
                  <div key={tx.id} className="p-3 bg-muted/30 rounded-xl border border-border">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm truncate flex-1">{tx.book_title}</p>
                      <div className="flex gap-1 shrink-0">
                        <Badge variant="outline" className="text-xs">{tx.type === 'rent' ? '대여' : '구매'}</Badge>
                        {getStatusBadge(tx.status)}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tx.owner_nickname} → {tx.borrower_nickname}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(tx.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Conversations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            메시지 현황
            <Badge variant="secondary" className="ml-2">{conversations.length}개</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">대화가 없습니다</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 pb-3 font-medium">참여자 1</th>
                      <th className="text-left py-2 pb-3 font-medium">참여자 2</th>
                      <th className="text-center py-2 pb-3 font-medium">메시지 수</th>
                      <th className="text-left py-2 pb-3 font-medium">마지막 활동</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {conversations.map((conv) => (
                      <tr key={conv.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4">{conv.participant_1_nickname}</td>
                        <td className="py-3 pr-4">{conv.participant_2_nickname}</td>
                        <td className="py-3 text-center">
                          <Badge variant="outline">{conv.message_count}</Badge>
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {conv.last_message_at
                            ? format(new Date(conv.last_message_at), 'yyyy.MM.dd HH:mm', { locale: ko })
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {conversations.map((conv) => (
                  <div key={conv.id} className="p-3 bg-muted/30 rounded-xl border border-border">
                    <p className="text-sm font-medium">
                      {conv.participant_1_nickname} · {conv.participant_2_nickname}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">메시지 {conv.message_count}개</Badge>
                      <span className="text-xs text-muted-foreground">
                        {conv.last_message_at
                          ? format(new Date(conv.last_message_at), 'yyyy.MM.dd HH:mm', { locale: ko })
                          : '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
