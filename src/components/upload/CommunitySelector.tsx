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
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">Visibility</label>
      
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
            "relative flex-1 py-3 flex items-center justify-center gap-2 text-sm font-semibold rounded-lg transition-colors z-10",
            isPublic ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Globe className="w-4 h-4" />
          Public
        </button>
        
        <button
          type="button"
          onClick={() => handlePublicToggle(false)}
          className={cn(
            "relative flex-1 py-3 flex items-center justify-center gap-2 text-sm font-semibold rounded-lg transition-colors z-10",
            !isPublic ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Users className="w-4 h-4" />
          Community
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
                You haven't joined any communities yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Join a community first to post private books.
              </p>
            </div>
          ) : (
            <Select
              value={selectedCommunityId || ''}
              onValueChange={(value) => onCommunityChange(value || null)}
            >
              <SelectTrigger className="h-12 bg-secondary border-border rounded-xl">
                <SelectValue placeholder="Select a community" />
              </SelectTrigger>
              <SelectContent>
                {myCommunities.map((community: Community) => (
                  <SelectItem key={community.id} value={community.id}>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>{community.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({community.memberCount} members)
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
