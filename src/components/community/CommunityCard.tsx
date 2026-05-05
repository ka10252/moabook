import { motion } from 'framer-motion';
import { Users, Lock, Check, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CommunityCardProps {
  id: string;
  name: string;
  description?: string | null;
  memberCount: number;
  coverUrl?: string | null;
  isJoined: boolean;
  isLeaving?: boolean;
  onJoin: () => void;
  onLeave: () => void;
}

export const CommunityCard = ({
  name,
  description,
  memberCount,
  coverUrl,
  isJoined,
  isLeaving,
  onJoin,
  onLeave,
}: CommunityCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border transition-all",
        isJoined 
          ? "bg-primary/5 border-primary/20" 
          : "bg-card border-border hover:border-primary/30"
      )}
    >
      {/* Cover Image */}
      <div className="relative h-24 bg-gradient-to-br from-primary/20 to-primary/5">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Users className="w-10 h-10 text-primary/30" />
          </div>
        )}
        
        {/* Status Badge */}
        {isJoined && (
          <div className="absolute top-2 right-2 flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
            <Check className="w-3 h-3" />
            가입됨
          </div>
        )}

        {/* Privacy indicator */}
        <div className="absolute top-2 left-2">
          <div className="flex items-center gap-1 text-xs bg-background/80 backdrop-blur-sm px-2 py-1 rounded-full text-muted-foreground">
            <Lock className="w-3 h-3" />
            비공개
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground truncate">{name}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {description}
          </p>
        )}
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">
            {memberCount}명
          </span>

          {isJoined ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={onLeave}
              disabled={isLeaving}
              className="text-muted-foreground hover:text-destructive h-8"
            >
              {isLeaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <LogOut className="w-4 h-4 mr-1" />
                  나가기
                </>
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onJoin}
              className="h-8"
            >
              가입
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
