import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Shuffle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const m = await loadAvatarManifest();
      if (cancelled) return;
      setManifest(m);
      if (user) {
        // 아바타(pixel_avatar)만 조회. '지금 읽는 책'은 이제 별도 ReadingBookPicker가 담당한다.
        const { data } = await supabase.from('profiles').select('pixel_avatar').eq('id', user.id).maybeSingle();
        if (!cancelled) {
          const row = data as { pixel_avatar?: unknown } | null;
          setConfig(clampToManifest(normalizeAvatar(row?.pixel_avatar), m));
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
      const { error } = await supabase.from('profiles').update({ pixel_avatar: config } as never).eq('id', user.id);
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
