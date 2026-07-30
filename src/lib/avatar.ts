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
}

export interface AvatarManifest {
  frame: { w: number; h: number; cols: number };
  anim: { idleRow: number; walkRow: number; perDir: number; dirOrder: string[] };
  order: string[];
  options: {
    body: string[];
    eyes: string[];
    hair: Record<string, string[]>;   // shape → colors
    outfit: Record<string, string[]>; // style → colors
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
  return { body: '05', eyes: '01', hairShape: '01', hairColor: '01', outfitStyle: '01', outfitColor: '01' };
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
  };
}

/** 합성 순서대로 레이어 이미지 URL 목록 (몸→눈→옷→헤어) */
export function avatarLayerUrls(c: AvatarConfig): string[] {
  return [
    `${AVATAR_BASE}/body/skin_${c.body}.png`,
    `${AVATAR_BASE}/eyes/eyes_${c.eyes}.png`,
    `${AVATAR_BASE}/outfit/outfit_${c.outfitStyle}_${c.outfitColor}.png`,
    `${AVATAR_BASE}/hair/hair_${c.hairShape}_${c.hairColor}.png`,
  ];
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

export const DIR_INDEX = { right: 0, up: 1, left: 2, down: 3 } as const;
export type Dir = keyof typeof DIR_INDEX;

/** 방향의 프레임 시작 열 (해당 방향 첫 프레임) */
export function dirCol(dir: Dir, perDir = 6): number {
  return DIR_INDEX[dir] * perDir;
}
