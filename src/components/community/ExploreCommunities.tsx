import { motion } from 'framer-motion';
import { Users, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Community {
  id: string;
  name: string;
  member_count: number | null;
  description?: string | null;
  cover_url?: string | null;
}

interface ExploreCommunitiesProps {
  communities: Community[];
  isLoading: boolean;
  onJoin: (community: Community) => void;
}

export const ExploreCommunities = ({
  communities,
  isLoading,
  onJoin,
}: ExploreCommunitiesProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (communities.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12"
      >
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">탐색할 커뮤니티가 없습니다</p>
        <p className="text-sm text-muted-foreground mt-1">
          직접 커뮤니티를 만들어보세요!
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        커뮤니티 둘러보기
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {communities.map((community, index) => (
          <motion.div
            key={community.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="relative overflow-hidden rounded-2xl border border-border bg-card hover:border-primary/30 transition-all"
          >
            {/* Cover */}
            <div className="relative h-20 bg-gradient-to-br from-primary/20 to-primary/5">
              {community.cover_url ? (
                <img
                  src={community.cover_url}
                  alt={community.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Users className="w-8 h-8 text-primary/30" />
                </div>
              )}
              <div className="absolute top-2 left-2">
                <div className="flex items-center gap-1 text-xs bg-background/80 backdrop-blur-sm px-2 py-1 rounded-full text-muted-foreground">
                  <Lock className="w-3 h-3" />
                  비공개
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="font-semibold text-foreground truncate">
                {community.name}
              </h3>
              {community.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {community.description}
                </p>
              )}
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">
                  {community.member_count || 0}명
                </span>
                <Button
                  size="sm"
                  onClick={() => onJoin(community)}
                  className="h-8"
                >
                  가입
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
