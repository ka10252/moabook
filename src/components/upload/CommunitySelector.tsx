import { Loader2, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { OptionButton } from './OptionButton';
import { Community, useCommunities } from '@/hooks/useCommunities';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CommunitySelectorProps {
  isPublic: boolean;
  selectedCommunityId: string | null;
  onPublicChange: (isPublic: boolean) => void;
  onCommunityChange: (communityId: string | null) => void;
}

export const CommunitySelector = ({
  isPublic,
  selectedCommunityId,
  onPublicChange,
  onCommunityChange,
}: CommunitySelectorProps) => {
  const { myCommunities, isLoading } = useCommunities();

  const handlePublicToggle = (value: boolean) => {
    onPublicChange(value);
    if (value) {
      onCommunityChange(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-bold tracking-wide text-muted-foreground">공개 범위</p>
      
      {/* 거래 방식·상태와 같은 버튼(OptionButton)을 쓴다.
          예전엔 회색 트랙 위를 미끄러지는 세그먼트라 혼자 다른 물건처럼 보였다. */}
      <div className="grid grid-cols-2 gap-2">
        <OptionButton label="전체 공개" active={isPublic} onClick={() => handlePublicToggle(true)} />
        <OptionButton label="커뮤니티" active={!isPublic} onClick={() => handlePublicToggle(false)} />
      </div>

      {!isPublic && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : myCommunities.length === 0 ? (
            <div className="p-4 bg-secondary rounded-xl text-center">
              <p className="text-sm text-muted-foreground">
                아직 가입한 커뮤니티가 없습니다.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                비공개 책을 등록하려면 먼저 커뮤니티에 가입하세요.
              </p>
            </div>
          ) : (
            <Select
              value={selectedCommunityId || ''}
              onValueChange={(value) => onCommunityChange(value || null)}
            >
              {/* min-w-0 + 안쪽 truncate: 이름이 길면 트리거가 밀려 글자가 잘려 보였다 */}
              <SelectTrigger className="h-12 w-full min-w-0 bg-secondary border-border rounded-xl [&>span]:truncate [&>span]:min-w-0 [&>span]:text-left">
                <SelectValue placeholder="커뮤니티 선택" />
              </SelectTrigger>
              <SelectContent>
                {myCommunities.map((community: Community) => (
                  <SelectItem key={community.id} value={community.id}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{community.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({community.memberCount}명)
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </motion.div>
      )}
    </div>
  );
};
