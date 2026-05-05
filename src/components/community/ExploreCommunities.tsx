import { motion } from 'framer-motion';
import { Users, Lock, Loader2, LogIn, BookOpen } from 'lucide-react';
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
  joinedCommunityIds: Set<string>;
  onJoin: (community: Community) => void;
  onEnter: (community: Community) => void;
}

export const ExploreCommunities = ({
  communities,
  isLoading,
  joinedCommunityIds = new Set(),
  onJoin,
  onEnter,
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full min-w-0">
        {communities.map((community, index) => {
          const isJoined = joinedCommunityIds.has(community.id);
          
          return (
            <motion.div
              key={community.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative overflow-hidden rounded-2xl group min-w-0 w-full"
            >
              {/* Full Background Image */}
              <div className="absolute inset-0">
                {community.cover_url ? (
                  <>
                    <img
                      src={community.cover_url}
                      alt={community.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-colors" />
                  </>
                ) : (
                  <>
                    <div className="w-full h-full bg-gradient-to-br from-primary/80 via-primary/60 to-accent/70" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                      <BookOpen className="w-20 h-20 text-white" />
                    </div>
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                  </>
                )}
              </div>

              {/* Content */}
              <div className="relative z-10 p-3 sm:p-4 min-w-0">
                {/* Status Badge */}
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <div className="flex items-center gap-1 text-[10px] sm:text-xs bg-white/20 backdrop-blur-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-white/90">
                    <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                    비공개
                  </div>
                  {isJoined && (
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs bg-primary/80 backdrop-blur-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-primary-foreground">
                      가입됨
                    </div>
                  )}
                </div>

                <h3 className="font-semibold text-white truncate drop-shadow-md text-sm sm:text-base">
                  {community.name}
                </h3>
                {community.description && (
                  <p className="text-[10px] sm:text-xs text-white/80 mt-1 line-clamp-2">
                    {community.description}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2 sm:mt-3 gap-2 min-w-0">
                  <span className="text-[10px] sm:text-xs text-white/70 flex-shrink-0">
                    {community.member_count || 0}명
                  </span>
                  {isJoined ? (
                    <Button
                      size="sm"
                      onClick={() => onEnter(community)}
                      className="h-7 sm:h-8 px-2.5 sm:px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground border-0 flex-shrink-0"
                    >
                      <LogIn className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 flex-shrink-0" />
                      입장
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => onJoin(community)}
                      className="h-7 sm:h-8 px-2.5 sm:px-3 text-xs bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white border-0 flex-shrink-0"
                    >
                      가입
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
