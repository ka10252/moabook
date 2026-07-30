/**
 * 픽셀 캐릭터(아바타) 공용 유틸.
 * 레이어(몸·눈·옷·헤어)를 겹쳐 하나의 캐릭터를 만든다.
 * 스프라이트: 32x64 프레임, 잘라낸 시트는 24열 × 2행(0=idle, 1=walk).
 * 방향 순서: right(0) up(6) left(12) down(18), 방향당 6프레임.
 */

export interface AvatarConfig {
  body: string;
  eyes: string;
  hairShape: string;
  hairColor: string;
  outfitStyle: string;
  outfitColor: string;
  accessory: string; // 액세서리 id, 없으면 'none'
}

export const NO_ACCESSORY = 'none';

export interface AvatarManifest {
  frame: { w: number; h: number; cols: number };
  anim: { idleRow: number; walkRow: number; perDir: number; dirOrder: string[] };
  order: string[];
  options: {
    body: string[];
    eyes: string[];
    hair: Record<string, string[]>;   // shape → colors
    outfit: Record<string, string[]>; // style → colors
    accessory?: string[];             // 액세서리 id 목록
  };
  default: AvatarConfig & { hairShape: string; hairColor: string; outfitStyle: string; outfitColor: string };
}

export const AVATAR_BASE = '/assets/avatar';

let manifestPromise: Promise<AvatarManifest> | null = null;
export function loadAvatarManifest(): Promise<AvatarManifest> {
  if (!manifestPromise) {
    manifestPromise = fetch(`${AVATAR_BASE}/manifest.json`).then((r) => {
      if (!r.ok) throw new Error('avatar manifest 로드 실패');
      return r.json();
    });
  }
  return manifestPromise;
}

export function defaultAvatar(): AvatarConfig {
  return { body: '05', eyes: '01', hairShape: '01', hairColor: '01', outfitStyle: '02', outfitColor: '01', accessory: NO_ACCESSORY };
}

/** 저장된 값이 부분적이거나 없을 때 안전한 기본값으로 채운다 */
export function normalizeAvatar(raw: unknown): AvatarConfig {
  const d = defaultAvatar();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<AvatarConfig>;
  return {
    body: r.body ?? d.body,
    eyes: r.eyes ?? d.eyes,
    hairShape: r.hairShape ?? d.hairShape,
    hairColor: r.hairColor ?? d.hairColor,
    outfitStyle: r.outfitStyle ?? d.outfitStyle,
    outfitColor: r.outfitColor ?? d.outfitColor,
    accessory: r.accessory ?? d.accessory,
  };
}

/** 합성 순서대로 레이어 (몸→눈→옷→헤어→액세서리). 액세서리 없으면 4개. */
export function avatarLayers(c: AvatarConfig): { key: string; url: string }[] {
  const layers = [
    { key: 'av_body', url: `${AVATAR_BASE}/body/skin_${c.body}.png` },
    { key: 'av_eyes', url: `${AVATAR_BASE}/eyes/eyes_${c.eyes}.png` },
    { key: 'av_outfit', url: `${AVATAR_BASE}/outfit/outfit_${c.outfitStyle}_${c.outfitColor}.png` },
    { key: 'av_hair', url: `${AVATAR_BASE}/hair/hair_${c.hairShape}_${c.hairColor}.png` },
  ];
  if (c.accessory && c.accessory !== NO_ACCESSORY) {
    layers.push({ key: 'av_acc', url: `${AVATAR_BASE}/accessory/acc_${c.accessory}.png` });
  }
  return layers;
}

/** 합성 순서대로 레이어 이미지 URL 목록 */
export function avatarLayerUrls(c: AvatarConfig): string[] {
  return avatarLayers(c).map((l) => l.url);
}

const imgCache = new Map<string, HTMLImageElement>();
export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imgCache.get(url);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => { imgCache.set(url, im); resolve(im); };
    im.onerror = () => reject(new Error(`이미지 로드 실패: ${url}`));
    im.src = url;
  });
}

/** 로드 실패 시 null (교체·삭제된 에셋을 가리키는 옛 저장값에 안전) */
export function loadImageSafe(url: string): Promise<HTMLImageElement | null> {
  return loadImage(url).catch(() => null);
}

/** 저장된 config가 현재 옵션에 없는 값을 가리키면 유효한 기본값으로 보정 */
export function clampToManifest(c: AvatarConfig, m: AvatarManifest): AvatarConfig {
  const o = m.options;
  const inList = (list: string[] | undefined, v: string, fb: string) => (list?.includes(v) ? v : (list?.[0] ?? fb));
  const next = { ...c };
  next.body = inList(o.body, c.body, '05');
  next.eyes = inList(o.eyes, c.eyes, '01');
  const hairShapes = Object.keys(o.hair);
  next.hairShape = hairShapes.includes(c.hairShape) ? c.hairShape : hairShapes[0];
  next.hairColor = inList(o.hair[next.hairShape], c.hairColor, '01');
  const outfitStyles = Object.keys(o.outfit);
  next.outfitStyle = outfitStyles.includes(c.outfitStyle) ? c.outfitStyle : outfitStyles[0];
  next.outfitColor = inList(o.outfit[next.outfitStyle], c.outfitColor, '01');
  if (c.accessory !== NO_ACCESSORY && !(o.accessory ?? []).includes(c.accessory)) next.accessory = NO_ACCESSORY;
  return next;
}

export const DIR_INDEX = { right: 0, up: 1, left: 2, down: 3 } as const;
export type Dir = keyof typeof DIR_INDEX;

/** 방향의 프레임 시작 열 (해당 방향 첫 프레임) */
export function dirCol(dir: Dir, perDir = 6): number {
  return DIR_INDEX[dir] * perDir;
}
