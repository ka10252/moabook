import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Search, Loader2, Check, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Community {
  id: string;
  name: string;
  member_count: number | null;
}

interface CommunityListProps {
  onSelectCommunity: (community: Community) => void;
  onCreateNew: () => void;
}

export const CommunityList = ({ onSelectCommunity, onCreateNew }: CommunityListProps) => {
  const { user } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [myCommunityIds, setMyCommunityIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [leavingId, setLeavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCommunities();
  }, [user]);

  const fetchCommunities = async () => {
    setIsLoading(true);
    try {
      // Fetch all communities
      const { data: allCommunities, error: commError } = await supabase
        .from('communities')
        .select('id, name, member_count')
        .order('name');

      if (commError) throw commError;

      setCommunities(allCommunities || []);

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
      fetchCommunities(); // Refresh member counts
    } catch (error) {
      console.error('Leave community error:', error);
      toast.error('Failed to leave community');
    } finally {
      setLeavingId(null);
    }
  };

  const filteredCommunities = communities.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const myCommunities = filteredCommunities.filter((c) => myCommunityIds.has(c.id));
  const otherCommunities = filteredCommunities.filter((c) => !myCommunityIds.has(c.id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
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

      {/* Create New Button */}
      <Button
        onClick={onCreateNew}
        variant="outline"
        className="w-full h-12 rounded-xl border-dashed border-2 hover:border-primary hover:bg-primary/5"
      >
        <Plus className="w-5 h-5 mr-2" />
        Create New Community
      </Button>

      <ScrollArea className="h-[calc(100vh-380px)]">
        <div className="space-y-6 pr-2">
          {/* My Communities */}
          {myCommunities.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                My Communities
              </h3>
              <div className="space-y-2">
                {myCommunities.map((community) => (
                  <motion.div
                    key={community.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{community.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {community.member_count || 0} member{(community.member_count || 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">
                        <Check className="w-3 h-3" />
                        Joined
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleLeaveCommunity(community.id, community.name)}
                        disabled={leavingId === community.id}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        {leavingId === community.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <LogOut className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Available Communities */}
          {otherCommunities.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Available Communities
              </h3>
              <div className="space-y-2">
                {otherCommunities.map((community) => (
                  <motion.button
                    key={community.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => onSelectCommunity(community)}
                    className="w-full flex items-center justify-between p-4 bg-secondary hover:bg-muted border border-border rounded-xl transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{community.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {community.member_count || 0} member{(community.member_count || 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-primary font-medium">Join →</span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {filteredCommunities.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No communities found' : 'No communities yet'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Be the first to create one!
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
