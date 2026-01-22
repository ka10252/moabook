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

  useEffect(() => {
    fetchCommunities();
  }, [user]);

  const fetchCommunities = async () => {
    setIsLoading(true);
    try {
      // Fetch all communities from DB
      const { data: dbCommunities, error: commError } = await supabase
        .from('communities')
        .select('id, name, member_count')
        .order('name');

      if (commError) throw commError;

      // Cast and add description/cover_url as optional
      const dbData = (dbCommunities || []).map(c => ({
        id: c.id,
        name: c.name,
        member_count: c.member_count,
        description: null as string | null,
        cover_url: null as string | null,
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
      toast.error('Failed to load communities');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveCommunity = async (communityId: string, communityName: string) => {
    if (!user) return;

    // Can't leave dummy communities
    if (communityId.startsWith('dummy-')) {
      toast.error("Demo community - can't leave");
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

      toast.success(`Left "${communityName}"`);
      fetchCommunities();
    } catch (error) {
      console.error('Leave community error:', error);
      toast.error('Failed to leave community');
    } finally {
      setLeavingId(null);
    }
  };

  const handleJoinCommunity = (community: Community) => {
    // Dummy communities can't be joined
    if (community.id.startsWith('dummy-')) {
      toast.info('This is a demo community. Create your own to get started!');
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
    <div className="h-full px-4 py-6 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
          <Users className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Communities</h1>
        <p className="text-muted-foreground mt-1">
          Join private groups to share books
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {view === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search communities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 bg-secondary border-border rounded-xl"
              />
            </div>

            <ScrollArea className="h-[calc(100vh-340px)]">
              <div className="space-y-6 pr-2">
                {/* My Communities */}
                <MyCommunities
                  communities={myCommunities}
                  isLoading={isLoading}
                  leavingId={leavingId}
                  onLeave={handleLeaveCommunity}
                  onViewAll={() => {}}
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
              className="fixed bottom-24 right-4"
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
  );
};
