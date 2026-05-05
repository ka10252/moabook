import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Eye, Loader2, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AdminCommunityDetailModal } from './AdminCommunityDetailModal';

interface CommunityData {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  created_at: string;
  creator_nickname: string;
  banned_count: number;
}

export const AdminCommunityManagement = () => {
  const [communities, setCommunities] = useState<CommunityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);

  useEffect(() => { fetchCommunities(); }, []);

  const fetchCommunities = async () => {
    setLoading(true);
    try {
      const [{ data }, { data: bannedData }] = await Promise.all([
        supabase.from('communities').select(`
          id, name, description, member_count, created_at,
          creator:profiles!communities_created_by_fkey(nickname)
        `).order('created_at', { ascending: false }),
        supabase.from('community_members').select('community_id').eq('is_banned', true),
      ]);

      const bannedMap: Record<string, number> = {};
      (bannedData || []).forEach(({ community_id }) => {
        bannedMap[community_id] = (bannedMap[community_id] ?? 0) + 1;
      });

      setCommunities((data || []).map((c: any) => ({
        id: c.id, name: c.name, description: c.description,
        member_count: c.member_count || 0, created_at: c.created_at,
        creator_nickname: c.creator?.nickname || '알 수 없음',
        banned_count: bannedMap[c.id] ?? 0,
      })));
    } catch (err) {
      console.error('Failed to fetch communities:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCommunities = communities.filter(
    (c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.creator_nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            커뮤니티 관리
            <Badge variant="secondary" className="ml-2">{communities.length}개</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="이름, 설명, 방장으로 검색..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCommunities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">검색 결과가 없습니다</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 pb-3 font-medium">커뮤니티</th>
                      <th className="text-left py-2 pb-3 font-medium">방장</th>
                      <th className="text-center py-2 pb-3 font-medium">멤버</th>
                      <th className="text-center py-2 pb-3 font-medium">차단</th>
                      <th className="text-left py-2 pb-3 font-medium">생성일</th>
                      <th className="text-right py-2 pb-3 font-medium">상세</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCommunities.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4">
                          <p className="font-medium">{c.name}</p>
                          {c.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.description}</p>}
                        </td>
                        <td className="py-3 pr-4 text-sm">{c.creator_nickname}</td>
                        <td className="py-3 text-center"><Badge variant="outline">{c.member_count}</Badge></td>
                        <td className="py-3 text-center">
                          {c.banned_count > 0
                            ? <Badge variant="destructive">{c.banned_count}</Badge>
                            : <Badge variant="outline">0</Badge>}
                        </td>
                        <td className="py-3 text-muted-foreground text-sm">{format(new Date(c.created_at), 'yyyy.MM.dd', { locale: ko })}</td>
                        <td className="py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedCommunityId(c.id)}>
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
                {filteredCommunities.map((c) => (
                  <div key={c.id}
                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border"
                    onClick={() => setSelectedCommunityId(c.id)}>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">방장 {c.creator_nickname}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">멤버 {c.member_count}명</span>
                        {c.banned_count > 0 && (
                          <Badge variant="destructive" className="text-xs">차단 {c.banned_count}</Badge>
                        )}
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selectedCommunityId && (
        <AdminCommunityDetailModal
          communityId={selectedCommunityId}
          onClose={() => setSelectedCommunityId(null)}
          onRefresh={fetchCommunities}
        />
      )}
    </>
  );
};
