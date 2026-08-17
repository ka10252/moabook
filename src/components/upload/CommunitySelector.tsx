import { Globe, Users, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
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
      <p className="text-[12px] font-bold tracking-wide text-muted-foreground">공개 범위</p>
      
      <div className="relative flex p-1 bg-muted rounded-xl">
        <motion.div
          className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-card rounded-lg shadow-sm"
          animate={{ left: isPublic ? '4px' : 'calc(50% + 2px)' }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
        />
        
        <button
          type="button"
          onClick={() => handlePublicToggle(true)}
          className={cn(
            "relative flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[12px] font-bold rounded-lg transition-colors z-10",
            isPublic ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Globe className="w-3.5 h-3.5" />
          전체 공개
        </button>
        
        <button
          type="button"
          onClick={() => handlePublicToggle(false)}
          className={cn(
            "relative flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[12px] font-bold rounded-lg transition-colors z-10",
            !isPublic ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Users className="w-3.5 h-3.5" />
          커뮤니티
        </button>
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
              <SelectTrigger className="h-12 bg-secondary border-border rounded-xl">
                <SelectValue placeholder="커뮤니티 선택" />
              </SelectTrigger>
              <SelectContent>
                {myCommunities.map((community: Community) => (
                  <SelectItem key={community.id} value={community.id}>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>{community.name}</span>
                      <span className="text-xs text-muted-foreground">
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
