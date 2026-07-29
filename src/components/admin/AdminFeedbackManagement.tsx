import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface FeedbackRow {
  id: string;
  user_id: string | null;
  category: string | null;
  message: string;
  created_at: string;
}

const CATEGORY_META: Record<string, { label: string; className: string }> = {
  bug: { label: '버그', className: 'bg-destructive/15 text-destructive' },
  idea: { label: '아이디어', className: 'bg-primary/15 text-primary' },
  etc: { label: '그 외', className: 'bg-muted text-muted-foreground' },
};

export const AdminFeedbackManagement = () => {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('category', filter);

    const { data, error } = await query;
    if (error) {
      toast.error('의견을 불러오지 못했습니다');
      console.error(error);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as FeedbackRow[];
    setRows(list);

    // feedback.user_id는 auth.users를 참조해 profiles와 직접 조인이 안 된다.
    // 작성자 닉네임은 별도로 한 번에 조회한다.
    const ids = [...new Set(list.map((r) => r.user_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, nickname').in('id', ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: { id: string; nickname: string }) => (map[p.id] = p.nickname));
      setNames(map);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> 받은 의견 {rows.length > 0 && `(${rows.length})`}
        </h2>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="bug">버그</TabsTrigger>
            <TabsTrigger value="idea">아이디어</TabsTrigger>
            <TabsTrigger value="etc">그 외</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">아직 받은 의견이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const cat = r.category ? CATEGORY_META[r.category] : null;
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {cat && <Badge className={cat.className}>{cat.label}</Badge>}
                  <span className="text-sm font-semibold text-foreground">
                    {r.user_id ? names[r.user_id] ?? '이웃' : '익명'}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ko })}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {r.message}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
