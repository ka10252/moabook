import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronRight, Loader2, LogOut } from 'lucide-react';
import { spineClassFrom } from '@/lib/spineColor';
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
  onCommunityClick,
}: MyCommunitiesProps) => {
  const [confirmLeave, setConfirmLeave] = useState<{ id: string; name: string } | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <section className="space-y-2">
        <p className="font-display italic text-[16px] text-foreground px-0.5">내 커뮤니티</p>

        {communities.length === 0 ? (
          <div className="bg-muted/60 rounded-[14px] p-5 text-center">
            <Users className="w-8 h-8 text-faint mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">아직 가입한 커뮤니티가 없습니다</p>
            <p className="text-[13px] text-faint mt-1">아래에서 커뮤니티를 찾아보세요</p>
          </div>
        ) : (
          <AnimatePresence>
            {communities.map((community) => (
              <motion.div
                key={community.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onClick={() => onCommunityClick?.(community)}
                className="flex items-center gap-3 bg-card border border-border rounded-[14px] p-3 cursor-pointer"
              >
                {community.cover_url ? (
                  <img
                    src={community.cover_url}
                    alt=""
                    className="w-[42px] h-[42px] rounded-[11px] object-cover shrink-0"
                  />
                ) : (
                  <span
                    className={`w-[42px] h-[42px] rounded-[11px] flex items-center justify-center shrink-0 font-display text-[19px] text-spine-text ${spineClassFrom(community.name)}`}
                  >
                    {community.name.charAt(0)}
                  </span>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-foreground truncate">{community.name}</p>
                  <p className="text-[12.5px] text-faint mt-0.5">
                    멤버 {community.member_count ?? 0}명
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmLeave({ id: community.id, name: community.name });
                  }}
                  disabled={leavingId === community.id}
                  className="p-1.5 rounded-full text-faint hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  title="탈퇴"
                >
                  {leavingId === community.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                </button>
                <ChevronRight className="w-[17px] h-[17px] text-faint shrink-0" />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </section>

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
              onClick={() => {
                if (confirmLeave) onLeave(confirmLeave.id, confirmLeave.name);
                setConfirmLeave(null);
              }}
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
