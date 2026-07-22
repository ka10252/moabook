import { motion } from 'framer-motion';
import { Users, Loader2 } from 'lucide-react';
import { spineClassFrom } from '@/lib/spineColor';

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

/**
 * 탐색 목록은 가입 여부만 다르고 나머지는 동일한 한 줄짜리 행이다.
 * 카드마다 커버 사진을 크게 깔면 이름이 안 읽힌다 — 여기서 필요한 정보는 이름·규모·행동뿐.
 */
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
        <Users className="w-12 h-12 text-faint mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">탐색할 커뮤니티가 없습니다</p>
        <p className="text-xs text-faint mt-1">직접 커뮤니티를 만들어보세요</p>
      </motion.div>
    );
  }

  return (
    <section className="space-y-1">
      <p className="font-display italic text-[15px] text-foreground px-0.5 mb-2">탐색</p>

      {communities.map((community, index) => {
        const isJoined = joinedCommunityIds.has(community.id);

        return (
          <motion.div
            key={community.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.04, 0.3) }}
            className="flex items-center gap-3 py-2.5 px-0.5 border-b border-border"
          >
            {community.cover_url ? (
              <img
                src={community.cover_url}
                alt=""
                className="w-[34px] h-[34px] rounded-[10px] object-cover shrink-0"
              />
            ) : (
              <span
                className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 font-display text-[16px] text-spine-text ${spineClassFrom(community.name)}`}
              >
                {community.name.charAt(0)}
              </span>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-foreground truncate">{community.name}</p>
              <p className="text-[10px] text-faint mt-0.5">멤버 {community.member_count ?? 0}명</p>
            </div>

            <button
              onClick={() => (isJoined ? onEnter(community) : onJoin(community))}
              className={`shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors ${
                isJoined
                  ? 'bg-primary text-primary-foreground'
                  : 'text-primary border border-primary hover:bg-primary/10'
              }`}
            >
              {isJoined ? '입장' : '참여'}
            </button>
          </motion.div>
        );
      })}
    </section>
  );
};
