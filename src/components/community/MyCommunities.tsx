import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronRight, Loader2, LogOut, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Community {
  id: string;
  name: string;
  member_count: number | null;
  description?: string | null;
  cover_url?: string | null;
  created_by?: string | null;
}

interface MyCommunitiesProps {
  communities: Community[];
  isLoading: boolean;
  leavingId: string | null;
  onLeave: (id: string, name: string) => void;
  onViewAll: () => void;
  onCommunityClick?: (community: Community) => void;
}

export const MyCommunities = ({
  communities,
  isLoading,
  leavingId,
  onLeave,
  onViewAll,
  onCommunityClick,
}: MyCommunitiesProps) => {
  const [confirmLeave, setConfirmLeave] = useState<{ id: string; name: string } | null>(null);

  const handleLeaveClick = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setConfirmLeave({ id, name });
  };

  const handleConfirmLeave = () => {
    if (confirmLeave) {
      onLeave(confirmLeave.id, confirmLeave.name);
      setConfirmLeave(null);
    }
  };

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
    <>
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
                  className="relative flex-shrink-0 w-48 h-28 rounded-xl overflow-hidden cursor-pointer group"
                  onClick={() => onCommunityClick?.(community)}
                >
                  {/* Background Image or Default */}
                  <div className="absolute inset-0">
                    {community.cover_url ? (
                      <>
                        <img
                          src={community.cover_url}
                          alt={community.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors" />
                      </>
                    ) : (
                      <>
                        <div className="w-full h-full bg-gradient-to-br from-primary/80 via-primary/60 to-accent/70" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                          <BookOpen className="w-14 h-14 text-white" />
                        </div>
                        <div className="absolute inset-0 bg-black/15 group-hover:bg-black/25 transition-colors" />
                      </>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="relative z-10 h-full p-3 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleLeaveClick(e, community.id, community.name)}
                        disabled={leavingId === community.id}
                        className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/20"
                      >
                        {leavingId === community.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <LogOut className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm truncate drop-shadow-md">
                        {community.name}
                      </p>
                      <p className="text-xs text-white/80">
                        {community.member_count || 0}명
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={!!confirmLeave} onOpenChange={() => setConfirmLeave(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>탈퇴하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmLeave?.name}" 커뮤니티에서 탈퇴합니다. 나중에 다시 가입할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLeave}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              나가기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
