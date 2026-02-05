import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

  useEffect(() => {
    fetchCommunities();
  }, []);

  const fetchCommunities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('communities')
        .select(`
          id, name, description, member_count, created_at,
          creator:profiles!communities_created_by_fkey(nickname)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch banned counts for each community
      const communitiesWithBanned = await Promise.all(
        (data || []).map(async (community: any) => {
          const { count } = await supabase
            .from('community_members')
            .select('*', { count: 'exact', head: true })
            .eq('community_id', community.id)
            .eq('is_banned', true);

          return {
            id: community.id,
            name: community.name,
            description: community.description,
            member_count: community.member_count || 0,
            created_at: community.created_at,
            creator_nickname: community.creator?.nickname || '알 수 없음',
            banned_count: count || 0,
          };
        })
      );

      setCommunities(communitiesWithBanned);
    } catch (err) {
      console.error('Failed to fetch communities:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCommunities = communities.filter(
    (community) =>
      community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      community.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      community.creator_nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            커뮤니티 관리
            <Badge variant="secondary" className="ml-2">
              {communities.length}개
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="이름, 설명, 방장으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>커뮤니티</TableHead>
                    <TableHead>방장</TableHead>
                    <TableHead className="text-center">멤버</TableHead>
                    <TableHead className="text-center">차단</TableHead>
                    <TableHead>생성일</TableHead>
                    <TableHead className="text-right">상세</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCommunities.map((community) => (
                    <TableRow key={community.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{community.name}</p>
                          {community.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {community.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{community.creator_nickname}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{community.member_count}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {community.banned_count > 0 ? (
                          <Badge variant="destructive">{community.banned_count}</Badge>
                        ) : (
                          <Badge variant="outline">0</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(community.created_at), 'yyyy.MM.dd', { locale: ko })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCommunityId(community.id)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCommunities.length === 0 && (
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

      {/* Community Detail Modal */}
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
