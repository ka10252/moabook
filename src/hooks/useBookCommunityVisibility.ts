import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * 책이 어느 커뮤니티 책장에 보이는지 (마이그 `20260820000001`).
 *
 * 규칙 — 한 표로 두 경우를 다룬다
 *   전체공개 책     : `visible=false` 행이 있으면 **그 커뮤니티에서 숨김**
 *   커뮤니티 전용 책 : `visible=true`  행이 있는 커뮤니티에만 **공개**
 *
 * ⚠️ 전체공개를 '제외 목록'으로 두는 이유: 포함 목록이면 등록 시점의 커뮤니티 집합이
 *    굳어서, 나중에 새 커뮤니티에 가입해도 예전 책이 그 책장에 안 나타난다.
 */
export interface VisibilityRow {
  book_id: string;
  community_id: string;
  visible: boolean;
}

/** 책 id 목록에 대한 공개 설정을 한 번에 읽어 Map으로 준다 */
export function useBookCommunityVisibility(bookIds: string[]) {
  const [rows, setRows] = useState<VisibilityRow[]>([]);
  const key = bookIds.join(',');

  useEffect(() => {
    if (!bookIds.length) { setRows([]); return; }
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('book_community_visibility' as never)
        .select('book_id, community_id, visible')
        .in('book_id', bookIds);
      if (!alive) return;
      // 마이그레이션 전이면 표가 없어 에러가 난다 — 서가가 죽지 않게 빈 값으로 둔다.
      // 그 경우 예전 규칙(전체공개 = 모든 커뮤니티 공개)으로 자연스럽게 떨어진다.
      if (!error) setRows((data ?? []) as unknown as VisibilityRow[]);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /** 이 책이 그 커뮤니티 책장에 보이는가 */
  const isVisibleIn = useCallback(
    (bookId: string, communityId: string, isPublic: boolean) => {
      const row = rows.find((r) => r.book_id === bookId && r.community_id === communityId);
      if (isPublic) return row ? row.visible : true;   // 제외 목록
      return row ? row.visible : false;                 // 포함 목록
    },
    [rows],
  );

  return { visibilityRows: rows, isVisibleIn };
}

/** 한 책의 설정을 통째로 저장한다(등록·수정 화면용). */
export async function saveBookCommunityVisibility(
  bookId: string,
  isPublic: boolean,
  /** 전체공개면 '숨길 커뮤니티', 커뮤니티 전용이면 '공개할 커뮤니티' */
  communityIds: string[],
): Promise<{ error: Error | null }> {
  const del = await supabase
    .from('book_community_visibility' as never)
    .delete()
    .eq('book_id', bookId);
  if (del.error) return { error: del.error as Error };

  if (!communityIds.length) return { error: null };

  const ins = await supabase.from('book_community_visibility' as never).insert(
    communityIds.map((community_id) => ({
      book_id: bookId,
      community_id,
      visible: !isPublic, // 전체공개면 숨김(false), 커뮤니티 전용이면 공개(true)
    })) as never,
  );
  return { error: (ins.error as Error) ?? null };
}
