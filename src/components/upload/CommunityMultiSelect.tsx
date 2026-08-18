import { ChevronDown, Users } from 'lucide-react';
import { useState } from 'react';
import type { Community } from '@/hooks/useCommunities';

interface Props {
  communities: Community[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** 아무것도 안 골랐을 때 트리거에 보일 문구 */
  placeholder: string;
}

/**
 * 커뮤니티 여러 개 고르기 — **드롭다운**이다.
 *
 * 예전엔 공개 범위(전체 공개 / 커뮤니티만)와 **똑같이 생긴 버튼**을 나열했다.
 * 같은 모양이 위아래로 붙으니 "이게 공개 범위인지 커뮤니티인지" 헷갈렸다.
 * 서가 필터의 역·지역 선택이 이미 이 드롭다운 방식이라 그 모양을 따른다 —
 * 앱 안에서 '여러 개 고르기'는 한 가지 모양이어야 한다.
 */
export const CommunityMultiSelect = ({ communities, selectedIds, onChange, placeholder }: Props) => {
  const [open, setOpen] = useState(false);

  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  const label = selectedIds
    .map((id) => communities.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full min-h-11 flex items-center justify-between gap-2 px-3 py-2 text-[13px] rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-1.5 text-left min-w-0">
          <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {selectedIds.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <span className="text-foreground font-medium truncate">{label}</span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            {communities.map((c) => {
              const checked = selectedIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={`w-full min-h-11 flex items-center gap-2 px-3 py-2.5 text-[13px] text-left transition-colors ${
                    checked
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'bg-card hover:bg-muted/60 text-foreground/80'
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      checked ? 'bg-primary border-primary' : 'border-border'
                    }`}
                  >
                    {checked && (
                      <svg className="w-2 h-2 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                    {c.memberCount}명
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
