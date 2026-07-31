import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Shuffle, X, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBookSearch } from '@/hooks/useBookSearch';
import type { ReadingBook } from '@/components/virtual/LibraryScene';
import { toast } from 'sonner';
import {
  type AvatarConfig,
  type AvatarManifest,
  loadAvatarManifest,
  defaultAvatar,
  normalizeAvatar,
  avatarLayerUrls,
  loadImageSafe,
  clampToManifest,
  AVATAR_BASE,
  NO_ACCESSORY,
} from '@/lib/avatar';

interface CharacterEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (config: AvatarConfig) => void;
}

// URL 빌더
const bodyUrl = (v: string) => `${AVATAR_BASE}/body/skin_${v}.png`;
const eyesUrl = (v: string) => `${AVATAR_BASE}/eyes/eyes_${v}.png`;
const hairUrl = (shape: string, color: string) => `${AVATAR_BASE}/hair/hair_${shape}_${color}.png`;
const outfitUrl = (style: string) => `${AVATAR_BASE}/outfit/outfit_${style}_01.png`;
const accUrl = (id: string) => `${AVATAR_BASE}/accessory/acc_${id}.png`;

// 32x64 정면 idle 셀 안의 관심 영역 (rx,ry,rw,rh)
const REGION = {
  head: [4, 17, 24, 27] as const,       // 머리+얼굴 (헤어·피부·헤어색)
  headTall: [4, 11, 24, 33] as const,   // 모자 포함 (액세서리)
  face: [5, 28, 22, 18] as const,       // 눈·볼 (눈)
  torso: [4, 42, 24, 20] as const,      // 상의 (옷)
};

/** 특정 레이어들을 정면 idle 셀의 한 영역만 잘라 그린다 (해당 에셋만 보여주기용). */
function LayerThumb({ urls, region, scale = 2 }: { urls: string[]; region: readonly [number, number, number, number]; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [rx, ry, rw, rh] = region;
  const key = urls.join('|') + region.join(',');
  useEffect(() => {
    let alive = true;
    Promise.all(urls.map(loadImageSafe)).then((raw) => {
      if (!alive) return;
      const imgs = raw.filter(Boolean) as HTMLImageElement[];
      const ctx = ref.current?.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, rw * scale, rh * scale);
      const sx = 18 * 32 + rx; // 정면 idle 셀(col18,row0) + 영역
      const sy = ry;
      for (const im of imgs) ctx.drawImage(im, sx, sy, rw, rh, 0, 0, rw * scale, rh * scale);
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, scale]);
  return <canvas ref={ref} width={rw * scale} height={rh * scale} style={{ imageRendering: 'pixelated', display: 'block' }} />;
}

/** 큰 프리뷰: 정면 걷기 애니메이션 (전신) */
function AvatarPreview({ config, size = 4 }: { config: AvatarConfig; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const imgsRef = useRef<HTMLImageElement[]>([]);
  const key = avatarLayerUrls(config).join('|');
  useEffect(() => {
    let alive = true;
    Promise.all(avatarLayerUrls(config).map(loadImageSafe)).then((raw) => { if (alive) imgsRef.current = raw.filter(Boolean) as HTMLImageElement[]; }).catch(() => {});
    const ctx = ref.current?.getContext('2d');
    let raf = 0, last = 0, frame = 0;
    const loop = (t: number) => {
      if (ctx && t - last > 160) {
        last = t; ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, 32 * size, 64 * size);
        const col = 18 + (frame % 6); // 정면 걷기
        for (const im of imgsRef.current) ctx.drawImage(im, col * 32, 1 * 64, 32, 64, 0, 0, 32 * size, 64 * size);
        frame++;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size]);
  return <canvas ref={ref} width={32 * size} height={64 * size} style={{ imageRendering: 'pixelated', display: 'block' }} />;
}

/** 아바타 얼굴을 정사각 blob으로 (프로필 사진용) — 머리+얼굴이 다 들어가게 */
async function renderAvatarBlob(config: AvatarConfig): Promise<Blob | null> {
  const imgs = (await Promise.all(avatarLayerUrls(config).map(loadImageSafe))).filter(Boolean) as HTMLImageElement[];
  const S = 8;
  const cvs = document.createElement('canvas');
  cvs.width = 24 * S; cvs.height = 24 * S;
  const ctx = cvs.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  const sx = 18 * 32 + 4, sy = 25; // 얼굴 중심(눈 y38) 기준 머리+얼굴 (y25~49)
  for (const im of imgs) ctx.drawImage(im, sx, sy, 24, 24, 0, 0, 24 * S, 24 * S);
  return new Promise((res) => cvs.toBlob(res, 'image/png'));
}

export function CharacterEditor({ isOpen, onClose, onSaved }: CharacterEditorProps) {
  const { user } = useAuth();
  const [manifest, setManifest] = useState<AvatarManifest | null>(null);
  const [config, setConfig] = useState<AvatarConfig>(defaultAvatar());
  const [saving, setSaving] = useState(false);
  const [asProfile, setAsProfile] = useState(true);
  const [readingBook, setReadingBook] = useState<ReadingBook | null>(null);
  const [myBooks, setMyBooks] = useState<ReadingBook[]>([]);
  const [bookQuery, setBookQuery] = useState('');
  const { results, isSearching, searchBooks, fetchBookDetails, clearResults } = useBookSearch();
  const bookDebounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const m = await loadAvatarManifest();
      if (cancelled) return;
      setManifest(m);
      if (user) {
        // 아바타는 반드시 있는 컬럼만 조회(reading_book 컬럼 미생성 시에도 아바타가 초기화되지 않게 분리)
        const { data } = await supabase.from('profiles').select('pixel_avatar, reading_book_id').eq('id', user.id).maybeSingle();
        // reading_book(jsonb 스냅샷)은 별도 조회 — 컬럼이 아직 없으면 에러만 나고 아바타엔 영향 없음
        const { data: rbData } = await supabase.from('profiles').select('reading_book').eq('id', user.id).maybeSingle();
        if (!cancelled) {
          const row = data as { pixel_avatar?: unknown; reading_book_id?: string | null } | null;
          const snap = (rbData as { reading_book?: ReadingBook | null } | null)?.reading_book;
          setConfig(clampToManifest(normalizeAvatar(row?.pixel_avatar), m));
          // 새 스냅샷 우선, 없으면 구버전 reading_book_id로 대체(제목은 아래 myBooks에서 못 채우면 빈값)
          setReadingBook(snap?.title ? snap : (row?.reading_book_id ? { id: row.reading_book_id, title: '' } : null));
        }
        // 내 책 + 대여 중인 책 (지금 읽는 책 후보) — 표지·저자까지 스냅샷용으로 가져온다
        const [owned, borrowed] = await Promise.all([
          supabase.from('books').select('id, title, author, cover_url').eq('owner_id', user.id),
          supabase.from('transactions').select('book:books(id, title, author, cover_url)').eq('borrower_id', user.id).eq('status', 'active'),
        ]);
        if (!cancelled) {
          type BookRow = { id: string; title: string; author?: string | null; cover_url?: string | null };
          const toRB = (b: BookRow): ReadingBook => ({ id: b.id, title: b.title, author: b.author ?? null, coverUrl: b.cover_url ?? null });
          const list: ReadingBook[] = [
            ...((owned.data ?? []) as BookRow[]).map(toRB),
            ...((borrowed.data ?? []) as Array<{ book: BookRow | null }>).map((t) => t.book).filter(Boolean).map((b) => toRB(b!)),
          ];
          setMyBooks(Array.from(new Map(list.map((b) => [b.id, b])).values()));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, user]);

  const setAttr = (patch: Partial<AvatarConfig>) => {
    if (!manifest) return;
    setConfig((c) => {
      const next = { ...c, ...patch };
      if (!manifest.options.hair[next.hairShape]?.includes(next.hairColor)) next.hairColor = manifest.options.hair[next.hairShape][0];
      return next;
    });
  };

  // 지금 읽는 책 검색 (디바운스) — 우리 책이 아니어도 아무 책이나 지정 가능
  const onBookQuery = (q: string) => {
    setBookQuery(q);
    if (bookDebounce.current) clearTimeout(bookDebounce.current);
    if (q.trim().length < 2) { clearResults(); return; }
    bookDebounce.current = setTimeout(() => searchBooks(q), 350);
  };

  const pickSearchResult = async (r: { key: string; title: string; author: string; cover: string | null; description: string | null }) => {
    // 검색으로 찾은 임의의 책은 우리 books에 없으므로 id 없이 스냅샷으로 저장한다
    setReadingBook({ id: null, title: r.title, author: r.author, coverUrl: r.cover, description: r.description });
    setBookQuery(''); clearResults();
    // 소개가 비어 있으면 상세를 한 번 더 시도해 보강
    if (!r.description) {
      const desc = await fetchBookDetails(r.key).catch(() => null);
      if (desc) setReadingBook((prev) => (prev && prev.id == null && prev.title === r.title ? { ...prev, description: desc } : prev));
    }
  };

  const randomize = () => {
    if (!manifest) return;
    const o = manifest.options;
    const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
    const hairShape = pick(Object.keys(o.hair));
    const accs = [NO_ACCESSORY, ...(o.accessory ?? [])];
    setConfig({
      body: pick(o.body), eyes: pick(o.eyes),
      hairShape, hairColor: pick(o.hair[hairShape]),
      outfitStyle: pick(Object.keys(o.outfit)), outfitColor: '01',
      accessory: pick(accs),
    });
  };

  const save = async () => {
    if (!user) { toast.error('로그인이 필요해요'); return; }
    setSaving(true);
    try {
      // reading_book(jsonb) 컬럼이 아직 없어도 캐릭터(아바타)는 반드시 저장되게 단계적으로 시도한다.
      // (컬럼 하나 때문에 저장 전체가 실패해 "저장하지 못했어요"가 뜨던 문제 방어)
      const attempts: Record<string, unknown>[] = [
        { pixel_avatar: config, reading_book: readingBook, reading_book_id: readingBook?.id ?? null },
        { pixel_avatar: config, reading_book_id: readingBook?.id ?? null },
        { pixel_avatar: config },
      ];
      let error: unknown = null;
      for (const patch of attempts) {
        const res = await supabase.from('profiles').update(patch as never).eq('id', user.id);
        if (!res.error) { error = null; break; }
        error = res.error;
      }
      if (error) throw error;
      if (asProfile) {
        const blob = await renderAvatarBlob(config);
        if (blob) {
          const path = `${user.id}/pixel_${Date.now()}.png`;
          const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/png' });
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
            await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
          }
        }
      }
      toast.success('내 캐릭터를 저장했어요');
      onSaved?.(config);
      onClose();
    } catch {
      toast.error('저장하지 못했어요');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  const o = manifest?.options;

  type Item = { v: string; urls: string[]; region: readonly [number, number, number, number]; sel: boolean; on: () => void };
  const sections: { label: string; items: Item[] }[] = manifest && o ? [
    {
      label: '피부', items: o.body.map((v) => ({
        v, urls: [bodyUrl(v)], region: REGION.head, sel: config.body === v, on: () => setAttr({ body: v }),
      })),
    },
    {
      label: '눈', items: o.eyes.map((v) => ({
        v, urls: [bodyUrl(config.body), eyesUrl(v)], region: REGION.face, sel: config.eyes === v, on: () => setAttr({ eyes: v }),
      })),
    },
    {
      label: '헤어', items: Object.keys(o.hair).map((v) => ({
        v, urls: [bodyUrl(config.body), hairUrl(v, o.hair[v].includes(config.hairColor) ? config.hairColor : o.hair[v][0])],
        region: REGION.head, sel: config.hairShape === v, on: () => setAttr({ hairShape: v }),
      })),
    },
    {
      label: '헤어 색', items: (o.hair[config.hairShape] ?? []).map((v) => ({
        v, urls: [bodyUrl(config.body), hairUrl(config.hairShape, v)], region: REGION.head, sel: config.hairColor === v, on: () => setAttr({ hairColor: v }),
      })),
    },
    {
      label: '옷', items: Object.keys(o.outfit).map((v) => ({
        v, urls: [bodyUrl(config.body), outfitUrl(v)], region: REGION.torso, sel: config.outfitStyle === v, on: () => setAttr({ outfitStyle: v }),
      })),
    },
    {
      label: '액세서리', items: [NO_ACCESSORY, ...(o.accessory ?? [])].map((v) => ({
        v,
        urls: v === NO_ACCESSORY ? [bodyUrl(config.body), hairUrl(config.hairShape, config.hairColor)]
          : [bodyUrl(config.body), hairUrl(config.hairShape, config.hairColor), accUrl(v)],
        region: REGION.headTall, sel: config.accessory === v, on: () => setAttr({ accessory: v }),
      })),
    },
  ] : [];

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex justify-center" onClick={onClose}>
      <div className="w-full max-w-[520px] h-full bg-background flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
          <h2 className="font-bold text-foreground">내 캐릭터</h2>
          <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 min-w-[52px] flex justify-center">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '저장'}
          </button>
        </header>

        <div className="flex flex-col items-center py-5 bg-muted/40 border-b border-border shrink-0 gap-3">
          <div className="rounded-2xl bg-card border border-border px-8 py-4 shadow-sm">
            <AvatarPreview config={config} size={4} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={randomize} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-card border border-border text-sm font-medium hover:bg-muted transition-colors">
              <Shuffle className="w-4 h-4 text-primary" /> 랜덤
            </button>
            <button onClick={() => setAsProfile((v) => !v)} className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${asProfile ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground'}`}>
              {asProfile && <Check className="w-4 h-4" />} 프로필 사진으로 설정
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {!manifest ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <>
            {/* 지금 읽는 책 — 캐릭터 머리 위 말풍선(표지)으로 표시됨 */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">지금 읽는 책</p>

              {/* 검색: 우리 책이 아니어도 아무 책이나 찾아서 지정 */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={bookQuery}
                  onChange={(e) => onBookQuery(e.target.value)}
                  placeholder="책 제목·저자로 검색"
                  className="w-full h-9 pl-9 pr-3 rounded-full bg-muted/50 border-0 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                />
                {(isSearching || results.length > 0) && bookQuery.trim().length >= 2 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                    {isSearching && results.length === 0 ? (
                      <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> 검색 중…
                      </div>
                    ) : (
                      results.map((r) => (
                        <button
                          key={r.key}
                          onClick={() => pickSearchResult(r)}
                          className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-muted/60 text-left"
                        >
                          {r.cover ? (
                            <img src={r.cover} alt="" loading="lazy" decoding="async" className="w-7 h-10 object-cover rounded shrink-0 bg-muted" />
                          ) : (
                            <div className="w-7 h-10 rounded bg-muted shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{r.title}</p>
                            <p className="text-[13px] text-muted-foreground truncate">{r.author}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 빠른 선택: 없음 + 내 책/대여 중인 책 + (검색으로 고른 임의의 책) */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setReadingBook(null)}
                  className={`shrink-0 px-3 h-9 rounded-full border text-xs font-medium ${!readingBook ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground bg-muted/40'}`}
                >없음</button>
                {/* 검색으로 고른(우리 책이 아닌) 책도 선택 상태로 보여준다 */}
                {readingBook && readingBook.id == null && (
                  <button
                    className="shrink-0 px-3 h-9 rounded-full border text-xs font-medium max-w-[180px] truncate border-primary text-primary bg-primary/10"
                  >📖 {readingBook.title}</button>
                )}
                {myBooks.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setReadingBook(b)}
                    className={`shrink-0 px-3 h-9 rounded-full border text-xs font-medium max-w-[160px] truncate ${readingBook?.id === b.id ? 'border-primary text-primary bg-primary/10' : 'border-border text-foreground bg-muted/40'}`}
                  >📖 {b.title}</button>
                ))}
              </div>
            </div>
            {sections.map((sec) => (
              <div key={sec.label}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{sec.label}</p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {sec.items.map((it) => (
                    <button
                      key={it.v}
                      onClick={it.on}
                      className={`shrink-0 rounded-xl border-2 p-1 bg-muted/40 transition-colors flex items-center justify-center min-w-[52px] min-h-[56px] ${it.sel ? 'border-primary' : 'border-transparent hover:border-border'}`}
                    >
                      {it.v === NO_ACCESSORY ? (
                        <span className="text-xs text-muted-foreground px-2">없음</span>
                      ) : (
                        <LayerThumb urls={it.urls} region={it.region} scale={2} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
