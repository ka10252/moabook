import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Shuffle, X } from 'lucide-react';
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

const SCALE = 4;
const CW = 32 * SCALE;
const CH = 64 * SCALE;

export function CharacterEditor({ isOpen, onClose, onSaved }: CharacterEditorProps) {
  const { user } = useAuth();
  const [manifest, setManifest] = useState<AvatarManifest | null>(null);
  const [config, setConfig] = useState<AvatarConfig>(defaultAvatar());
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const rafRef = useRef<number>();

  // 매니페스트 + 저장된 아바타 불러오기
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

  // config 바뀌면 레이어 이미지 재로딩
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    Promise.all(avatarLayerUrls(config).map(loadImage))
      .then((imgs) => { if (!cancelled) imagesRef.current = imgs; })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [config, isOpen]);

  // 프리뷰: 아래 방향 걷기 애니메이션 (row1, cols 18-23)
  useEffect(() => {
    if (!isOpen) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let frame = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 160) {
        last = t;
        ctx.clearRect(0, 0, CW, CH);
        const col = 18 + (frame % 6); // down 방향(18) + 걷기 프레임
        for (const im of imagesRef.current) {
          ctx.drawImage(im, col * 32, 1 * 64, 32, 64, 0, 0, CW, CH); // row1 = walk
        }
        frame++;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isOpen]);

  const cycle = useCallback((list: string[], cur: string, dir: 1 | -1): string => {
    if (!list.length) return cur;
    const i = Math.max(0, list.indexOf(cur));
    return list[(i + dir + list.length) % list.length];
  }, []);

  const step = (key: keyof AvatarConfig, dir: 1 | -1) => {
    if (!manifest) return;
    setConfig((c) => {
      const o = manifest.options;
      const next = { ...c };
      if (key === 'body') next.body = cycle(o.body, c.body, dir);
      else if (key === 'eyes') next.eyes = cycle(o.eyes, c.eyes, dir);
      else if (key === 'hairShape') {
        next.hairShape = cycle(Object.keys(o.hair), c.hairShape, dir);
        if (!o.hair[next.hairShape]?.includes(next.hairColor)) next.hairColor = o.hair[next.hairShape][0];
      } else if (key === 'hairColor') next.hairColor = cycle(o.hair[c.hairShape] ?? [], c.hairColor, dir);
      else if (key === 'outfitStyle') {
        next.outfitStyle = cycle(Object.keys(o.outfit), c.outfitStyle, dir);
        if (!o.outfit[next.outfitStyle]?.includes(next.outfitColor)) next.outfitColor = o.outfit[next.outfitStyle][0];
      } else if (key === 'outfitColor') next.outfitColor = cycle(o.outfit[c.outfitStyle] ?? [], c.outfitColor, dir);
      return next;
    });
  };

  const randomize = () => {
    if (!manifest) return;
    const o = manifest.options;
    const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
    const hairShape = pick(Object.keys(o.hair));
    const outfitStyle = pick(Object.keys(o.outfit));
    setConfig({
      body: pick(o.body),
      eyes: pick(o.eyes),
      hairShape,
      hairColor: pick(o.hair[hairShape]),
      outfitStyle,
      outfitColor: pick(o.outfit[outfitStyle]),
    });
  };

  const save = async () => {
    if (!user) { toast.error('로그인이 필요해요'); return; }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ pixel_avatar: config } as never).eq('id', user.id);
    setSaving(false);
    if (error) { toast.error('저장하지 못했어요'); return; }
    toast.success('내 캐릭터를 저장했어요');
    onSaved?.(config);
    onClose();
  };

  if (!isOpen) return null;

  const rows: { key: keyof AvatarConfig; label: string; list: string[]; cur: string }[] = manifest
    ? [
        { key: 'body', label: '피부', list: manifest.options.body, cur: config.body },
        { key: 'eyes', label: '눈', list: manifest.options.eyes, cur: config.eyes },
        { key: 'hairShape', label: '헤어', list: Object.keys(manifest.options.hair), cur: config.hairShape },
        { key: 'hairColor', label: '헤어 색', list: manifest.options.hair[config.hairShape] ?? [], cur: config.hairColor },
        { key: 'outfitStyle', label: '옷', list: Object.keys(manifest.options.outfit), cur: config.outfitStyle },
        { key: 'outfitColor', label: '옷 색', list: manifest.options.outfit[config.outfitStyle] ?? [], cur: config.outfitColor },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex justify-center" onClick={onClose}>
      <div className="w-full max-w-[520px] h-full bg-background flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
          <h2 className="font-bold text-foreground">내 캐릭터</h2>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '저장'}
          </button>
        </header>

        {/* Preview */}
        <div className="flex flex-col items-center justify-center py-7 bg-muted/40 border-b border-border shrink-0">
          <div className="rounded-2xl bg-card border border-border px-8 py-5 shadow-sm">
            <canvas ref={canvasRef} width={CW} height={CH} style={{ imageRendering: 'pixelated' }} />
          </div>
          <button onClick={randomize} className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-full bg-card border border-border text-sm font-medium hover:bg-muted transition-colors">
            <Shuffle className="w-4 h-4 text-primary" /> 랜덤
          </button>
        </div>

        {/* Pickers */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
          {!manifest ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            rows.map((row) => {
              const idx = Math.max(0, row.list.indexOf(row.cur));
              return (
                <div key={row.key} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-muted/40">
                  <span className="text-sm font-medium text-foreground">{row.label}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => step(row.key, -1)} className="p-1.5 rounded-lg hover:bg-card transition-colors" aria-label="이전">
                      <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">{idx + 1} / {row.list.length}</span>
                    <button onClick={() => step(row.key, 1)} className="p-1.5 rounded-lg hover:bg-card transition-colors" aria-label="다음">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
