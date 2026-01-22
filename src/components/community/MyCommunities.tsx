import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronRight, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface Community {
  id: string;
  name: string;
  member_count: number | null;
  description?: string | null;
  cover_url?: string | null;
}

interface MyCommunitiesProps {
  communities: Community[];
  isLoading: boolean;
  leavingId: string | null;
  onLeave: (id: string, name: string) => void;
  onViewAll: () => void;
}

export const MyCommunities = ({
  communities,
  isLoading,
  leavingId,
  onLeave,
  onViewAll,
}: MyCommunitiesProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (communities.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-secondary/50 rounded-2xl p-6 text-center"
      >
        <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          아직 가입한 커뮤니티가 없습니다.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          아래에서 커뮤니티를 찾아보세요!
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          내 커뮤니티
        </h2>
        {communities.length > 3 && (
          <button
            onClick={onViewAll}
            className="text-xs text-primary flex items-center gap-1 hover:underline"
          >
            전체 보기
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 pb-2">
          <AnimatePresence>
            {communities.map((community) => (
              <motion.div
                key={community.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex-shrink-0 w-48 bg-primary/5 border border-primary/20 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                      {community.cover_url ? (
                        <img
                          src={community.cover_url}
                          alt={community.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <Users className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <p className="font-medium text-foreground text-sm truncate">
                      {community.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {community.member_count || 0}명
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onLeave(community.id, community.name)}
                    disabled={leavingId === community.id}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
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
          </AnimatePresence>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
