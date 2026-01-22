import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MyCommunities } from './MyCommunities';
import { ExploreCommunities } from './ExploreCommunities';
import { CreateCommunityForm } from './CreateCommunityForm';
import { JoinCommunityForm } from './JoinCommunityForm';
import { CommunityDetailModal } from './CommunityDetailModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { dummyCommunities } from '@/data/dummyCommunities';

type View = 'list' | 'create' | 'join';

interface Community {
  id: string;
  name: string;
  member_count: number | null;
  description?: string | null;
  cover_url?: string | null;
  created_by?: string | null;
}

export const CommunityPage = () => {
  const { user } = useAuth();
  const [view, setView] = useState<View>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [myCommunityIds, setMyCommunityIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [detailCommunity, setDetailCommunity] = useState<Community | null>(null);

  useEffect(() => {
    fetchCommunities();
  }, [user]);

  const fetchCommunities = async () => {
    setIsLoading(true);
    try {
      // Fetch all communities from DB
      const { data: dbCommunities, error: commError } = await supabase
        .from('communities')
        .select('id, name, member_count, description, cover_url, created_by')
        .order('name');

      if (commError) throw commError;

      const dbData = (dbCommunities || []).map(c => ({
        id: c.id,
        name: c.name,
        member_count: c.member_count,
        description: c.description as string | null,
        cover_url: c.cover_url as string | null,
        created_by: c.created_by as string | null,
      }));

      // Merge with dummy data for demo (filter out duplicates)
      const dbIds = new Set(dbData.map(c => c.id));
      const dummyToAdd = dummyCommunities
        .filter(d => !dbIds.has(d.id))
        .map(d => ({
          id: d.id,
          name: d.name,
          member_count: d.member_count,
          description: d.description,
          cover_url: d.cover_url,
          created_by: null,
        }));

      setCommunities([...dbData, ...dummyToAdd]);

      // Fetch user's memberships
      if (user) {
        const { data: memberships, error: memError } = await supabase
          .from('community_members')
          .select('community_id')
          .eq('user_id', user.id);

        if (memError) throw memError;

        const ids = new Set((memberships || []).map((m) => m.community_id));
        setMyCommunityIds(ids);
      }
    } catch (error) {
      console.error('Fetch communities error:', error);
      toast.error('커뮤니티를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveCommunity = async (communityId: string, communityName: string) => {
    if (!user) return;

    // Can't leave dummy communities
    if (communityId.startsWith('dummy-')) {
      toast.error("데모 커뮤니티에서는 탈퇴할 수 없습니다");
      return;
    }

    setLeavingId(communityId);
    try {
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', user.id);

      if (error) throw error;

      setMyCommunityIds((prev) => {
        const next = new Set(prev);
        next.delete(communityId);
        return next;
      });

      toast.success(`"${communityName}"에서 탈퇴했습니다`);
      fetchCommunities();
    } catch (error) {
      console.error('Leave community error:', error);
      toast.error('커뮤니티 탈퇴에 실패했습니다');
    } finally {
      setLeavingId(null);
    }
  };

  const handleJoinCommunity = (community: Community) => {
    // Dummy communities can't be joined
    if (community.id.startsWith('dummy-')) {
      toast.info('데모 커뮤니티입니다. 직접 커뮤니티를 만들어보세요!');
      return;
    }
    setSelectedCommunity(community);
    setView('join');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedCommunity(null);
    fetchCommunities();
  };

  // Filter communities by search
  const filteredCommunities = communities.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const myCommunities = filteredCommunities.filter((c) => myCommunityIds.has(c.id));
  const exploreCommunities = filteredCommunities.filter((c) => !myCommunityIds.has(c.id));

  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 px-4 pt-6 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl mb-3">
            <Users className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">커뮤니티</h1>
          <p className="text-muted-foreground text-sm mt-1">
            비공개 그룹에서 책을 나눠보세요
          </p>
        </motion.div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-full"
            >
              {/* Search Bar - Fixed */}
              <div className="flex-shrink-0 px-4 pb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="커뮤니티 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 bg-secondary border-border rounded-xl"
                  />
                </div>
              </div>

              {/* Scrollable Content */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-6 px-4 pb-24">
                  {/* My Communities */}
                  <MyCommunities
                    communities={myCommunities}
                    isLoading={isLoading}
                    leavingId={leavingId}
                    onLeave={handleLeaveCommunity}
                    onViewAll={() => {}}
                    onCommunityClick={(community) => setDetailCommunity(community)}
                  />

                  {/* Explore Communities */}
                  <ExploreCommunities
                    communities={exploreCommunities}
                    isLoading={isLoading}
                    onJoin={handleJoinCommunity}
                  />
                </div>
              </ScrollArea>

              {/* FAB - Create Community */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="fixed bottom-24 right-4 z-10"
              >
                <Button
                  size="lg"
                  onClick={() => setView('create')}
                  className="h-14 w-14 rounded-full shadow-lg"
                >
                  <Plus className="w-6 h-6" />
                </Button>
              </motion.div>
            </motion.div>
          )}

          {view === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 pb-24 overflow-auto h-full"
            >
              <CreateCommunityForm
                onSuccess={handleBackToList}
                onCancel={handleBackToList}
              />
            </motion.div>
          )}

          {view === 'join' && selectedCommunity && (
            <motion.div
              key="join"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 pb-24 overflow-auto h-full"
            >
              <JoinCommunityForm
                community={selectedCommunity}
                onSuccess={handleBackToList}
                onBack={handleBackToList}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Community Detail Modal */}
      <CommunityDetailModal
        isOpen={!!detailCommunity}
        onClose={() => setDetailCommunity(null)}
        community={detailCommunity}
        onCommunityDeleted={fetchCommunities}
      />
    </div>
  );
};
