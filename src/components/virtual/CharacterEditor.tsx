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
  loadImage,
} from '@/lib/avatar';

interface CharacterEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (config: AvatarConfig) => void;
}

/** 정면(아래) idle 프레임을 캔버스에 그린다. 갤러리 썸네일 + 큰 프리뷰 공용. */
function AvatarView({ config, size = 1, animate = false }: { config: AvatarConfig; size?: number; animate?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const imgsRef = useRef<HTMLImageElement[]>([]);
  const key = `${config.body}|${config.eyes}|${config.hairShape}|${config.hairColor}|${config.outfitStyle}|${config.outfitColor}`;

  useEffect(() => {
    let alive = true;
    Promise.all(avatarLayerUrls(config).map(loadImage)).then((imgs) => {
      if (!alive) return;
      imgsRef.current = imgs;
      if (!animate) draw(0);
    }).catch(() => {});
    const ctx = ref.current?.getContext('2d');
    function draw(frame: number) {
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 32 * size, 64 * size);
      const col = animate ? 18 + (frame % 6) : 18; // down 방향(18), animate면 걷기
      const row = animate ? 1 : 0; // walk row : idle row
      for (const im of imgsRef.current) ctx.drawImage(im, col * 32, row * 64, 32, 64, 0, 0, 32 * size, 64 * size);
    }
    let raf = 0; let last = 0; let frame = 0;
    if (animate) {
      const loop = (t: number) => { if (t - last > 160) { last = t; draw(frame++); } raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    }
    return () => { alive = false; if (raf) cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, animate, size]);

  return <canvas ref={ref} width={32 * size} height={64 * size} style={{ imageRendering: 'pixelated', display: 'block' }} />;
}

/** 아바타 머리+상반신을 정사각 blob으로 (프로필 사진용) */
async function renderAvatarBlob(config: AvatarConfig): Promise<Blob | null> {
  const imgs = await Promise.all(avatarLayerUrls(config).map(loadImage));
  const S = 8;
  const cvs = document.createElement('canvas');
  cvs.width = 26 * S; cvs.height = 26 * S;
  const ctx = cvs.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  const sx = 18 * 32 + 3, sy = 9; // 정면 idle 셀 안의 머리+어깨 영역
  for (const im of imgs) ctx.drawImage(im, sx, sy, 26, 26, 0, 0, 26 * S, 26 * S);
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
        const { data } = await supabase.from('profiles').select('pixel_avatar').eq('id', user.id).maybeSingle();
        if (!cancelled) setConfig(normalizeAvatar((data as { pixel_avatar?: unknown } | null)?.pixel_avatar));
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, user]);

  const clampColors = (c: AvatarConfig, m: AvatarManifest): AvatarConfig => {
    const next = { ...c };
    if (!m.options.hair[next.hairShape]?.includes(next.hairColor)) next.hairColor = m.options.hair[next.hairShape][0];
    if (!m.options.outfit[next.outfitStyle]?.includes(next.outfitColor)) next.outfitColor = m.options.outfit[next.outfitStyle][0];
    return next;
  };

  const setAttr = (patch: Partial<AvatarConfig>) => {
    if (!manifest) return;
    setConfig((c) => clampColors({ ...c, ...patch }, manifest));
  };

  const randomize = () => {
    if (!manifest) return;
    const o = manifest.options;
    const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
    const hairShape = pick(Object.keys(o.hair));
    const outfitStyle = pick(Object.keys(o.outfit));
    setConfig({
      body: pick(o.body), eyes: pick(o.eyes),
      hairShape, hairColor: pick(o.hair[hairShape]),
      outfitStyle, outfitColor: pick(o.outfit[outfitStyle]),
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
  // 섹션: (라벨, 옵션 리스트, 각 옵션 → 미리보기 config, 현재 선택 여부, 선택 핸들러)
  const sections = manifest && o ? [
    { label: '피부', items: o.body.map((v) => ({ v, cfg: { ...config, body: v }, sel: config.body === v, on: () => setAttr({ body: v }) })) },
    { label: '눈', items: o.eyes.map((v) => ({ v, cfg: { ...config, eyes: v }, sel: config.eyes === v, on: () => setAttr({ eyes: v }) })) },
    { label: '헤어', items: Object.keys(o.hair).map((v) => ({ v, cfg: clampColors({ ...config, hairShape: v }, manifest), sel: config.hairShape === v, on: () => setAttr({ hairShape: v }) })) },
    { label: '헤어 색', items: (o.hair[config.hairShape] ?? []).map((v) => ({ v, cfg: { ...config, hairColor: v }, sel: config.hairColor === v, on: () => setAttr({ hairColor: v }) })) },
    { label: '옷', items: Object.keys(o.outfit).map((v) => ({ v, cfg: clampColors({ ...config, outfitStyle: v }, manifest), sel: config.outfitStyle === v, on: () => setAttr({ outfitStyle: v }) })) },
    { label: '옷 색', items: (o.outfit[config.outfitStyle] ?? []).map((v) => ({ v, cfg: { ...config, outfitColor: v }, sel: config.outfitColor === v, on: () => setAttr({ outfitColor: v }) })) },
  ] : [];

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex justify-center" onClick={onClose}>
      <div className="w-full max-w-[520px] h-full bg-background flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
          <h2 className="font-bold text-foreground">내 캐릭터</h2>
          <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 min-w-[52px] flex justify-center">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '저장'}
          </button>
        </header>

        {/* Preview + 랜덤 + 프로필사진 토글 */}
        <div className="flex flex-col items-center py-5 bg-muted/40 border-b border-border shrink-0 gap-3">
          <div className="rounded-2xl bg-card border border-border px-8 py-4 shadow-sm">
            <AvatarView config={config} size={4} animate />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={randomize} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-card border border-border text-sm font-medium hover:bg-muted transition-colors">
              <Shuffle className="w-4 h-4 text-primary" /> 랜덤
            </button>
            <button
              onClick={() => setAsProfile((v) => !v)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${asProfile ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground'}`}
            >
              {asProfile && <Check className="w-4 h-4" />} 프로필 사진으로 설정
            </button>
          </div>
        </div>

        {/* 갤러리: 항목별 썸네일 (보고 선택) */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {!manifest ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            sections.map((sec) => (
              <div key={sec.label}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{sec.label}</p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {sec.items.map((it) => (
                    <button
                      key={it.v}
                      onClick={it.on}
                      className={`shrink-0 rounded-xl border-2 p-1 bg-card transition-colors ${it.sel ? 'border-primary' : 'border-transparent hover:border-border'}`}
                    >
                      <div className="w-12 h-16 flex items-end justify-center overflow-hidden">
                        <AvatarView config={it.cfg} size={2} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
