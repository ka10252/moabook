import { useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Community, useCommunities } from '@/hooks/useCommunities';
import { OptionButton } from './OptionButton';

interface CommunitySelectorProps {
  isPublic: boolean;
  /**
   * 전체공개면 **숨길** 커뮤니티, 커뮤니티 전용이면 **공개할** 커뮤니티.
   * 한 값으로 두 뜻을 쓰는 이유는 `useBookCommunityVisibility` 주석 참고.
   */
  selectedCommunityIds: string[];
  onPublicChange: (isPublic: boolean) => void;
  onCommunityIdsChange: (ids: string[]) => void;
}

export const CommunitySelector = ({
  isPublic,
  selectedCommunityIds,
  onPublicChange,
  onCommunityIdsChange,
}: CommunitySelectorProps) => {
  const { myCommunities, isLoading } = useCommunities();
  // 전체공개일 때 '숨기기'는 **접어 둔다.** 대부분은 손댈 일이 없고,
  // 펼쳐 두면 등록 화면에 결정거리가 하나 더 생긴다.
  const [showHide, setShowHide] = useState(false);

  const toggle = (id: string) =>
    onCommunityIdsChange(
      selectedCommunityIds.includes(id)
        ? selectedCommunityIds.filter((x) => x !== id)
        : [...selectedCommunityIds, id],
    );

  const setPublic = (next: boolean) => {
    onPublicChange(next);
    // 뜻이 정반대인 값이라(숨길 곳 ↔ 공개할 곳) 모드를 바꾸면 비운다.
    // 안 비우면 "숨기려고 고른 커뮤니티"가 "공개할 커뮤니티"로 뒤집힌다.
    onCommunityIdsChange([]);
    setShowHide(false);
  };

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-bold tracking-wide text-muted-foreground">공개 범위</p>

      <div className="grid grid-cols-2 gap-2">
        <OptionButton label="전체 공개" active={isPublic} onClick={() => setPublic(true)} />
        <OptionButton label="커뮤니티만" active={!isPublic} onClick={() => setPublic(false)} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : myCommunities.length === 0 ? (
        !isPublic && (
          <div className="p-4 bg-secondary rounded-xl text-center">
            <p className="text-[13px] text-muted-foreground">아직 가입한 커뮤니티가 없어요.</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              커뮤니티에만 올리려면 먼저 커뮤니티에 가입해주세요.
            </p>
          </div>
        )
      ) : isPublic ? (
        /* 전체공개 — 숨길 커뮤니티는 접어 둔다 */
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowHide((v) => !v)}
            aria-expanded={showHide}
            className="w-full min-h-11 px-3.5 py-3 flex items-center gap-2 text-left"
          >
            <span className="text-[13px] text-muted-foreground">특정 커뮤니티에서 숨기기</span>
            {!showHide && selectedCommunityIds.length > 0 && (
              <span className="text-[13px] text-primary font-bold">{selectedCommunityIds.length}곳</span>
            )}
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground shrink-0 ml-auto transition-transform ${showHide ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence initial={false}>
            {showHide && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3.5 pb-3.5 pt-1 border-t border-border space-y-2">
                  <p className="text-[11px] text-faint leading-relaxed">
                    고른 커뮤니티의 책장에는 이 책이 올라가지 않아요. 그 밖에는 그대로 보여요.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {myCommunities.map((c: Community) => (
                      <OptionButton
                        key={c.id}
                        label={c.name}
                        active={selectedCommunityIds.includes(c.id)}
                        onClick={() => toggle(c.id)}
                        multi
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* 커뮤니티 전용 — 올릴 곳을 고른다. 여러 곳 가능 */
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {myCommunities.map((c: Community) => (
              <OptionButton
                key={c.id}
                label={c.name}
                active={selectedCommunityIds.includes(c.id)}
                onClick={() => toggle(c.id)}
                multi
              />
            ))}
          </div>
          {selectedCommunityIds.length === 0 && (
            <p className="text-[11px] text-faint">올릴 커뮤니티를 하나 이상 골라주세요.</p>
          )}
        </div>
      )}
    </div>
  );
};
