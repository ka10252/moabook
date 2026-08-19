/**
 * 표지에서 책등 색을 만든다.
 *
 * 규칙 하나만 기억하면 된다: **색상(H)만 표지에서 가져오고, 채도·명도는 우리가 정한다.**
 * 표지색을 통째로 쓰면 탁한 표지가 탁한 책등이 되어 지금과 달라지는 게 없고,
 * 밝은 표지에서는 크림색 제목이 사라진다.
 */

/**
 * 책등 팔레트 — 서로 어울리도록 고른 10색.
 *
 * 표지에서 뽑은 색상을 **그대로 쓰지 않는** 이유: 색상이 색상환 전체에 흩어져
 * 서가가 알록달록해지고 책끼리 안 어울린다. 어울림은 색상이 아니라
 * **채도·명도가 서로 맞을 때** 생긴다.
 *
 * 그래서 팔레트는 고정하고, **어느 칸을 쓸지만 표지가 정한다**(가장 가까운 색상).
 * 청록 표지는 민트 칸으로, 빨강 표지는 로즈 칸으로 간다 —
 * 색은 늘 어울리면서 표지와의 연결도 남는다.
 *
 * 마지막 두 칸은 일부러 어둡다. 전부 파스텔이면 서가가 평평해진다 —
 * 명암 대비가 원래 '칙칙함'의 진짜 원인이었다.
 */
const PALETTE: readonly [number, number, number][] = [
  [352, 38, 84],  // 로즈
  [25, 46, 82],   // 살구
  [42, 44, 84],   // 버터
  [100, 24, 76],  // 세이지
  [172, 30, 78],  // 민트
  [200, 36, 82],  // 하늘
  [232, 28, 82],  // 페리윙클
  [280, 24, 82],  // 라벤더
  [14, 30, 62],   // 테라코타 — 짙은 악센트
  [210, 24, 48],  // 데님 — 짙은 악센트
];

/** 색상환에서 두 색상이 떨어진 각도 (0~180) */
const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

export interface SpineColor {
  /** CSS 색 */
  bg: string;
  /** 배경 명도에 맞춘 글자색 — 밝은 책등에 크림 글씨를 쓰면 안 보인다 */
  fg: string;
  /** 위아래 장식 선 — 배경보다 밝거나 어둡게 */
  line: string;
  /** 명도(0~100). 그림자 세기 같은 걸 조절할 때 쓴다 */
  l: number;
}

const hashOf = (seed: string) => {
  let a = 7;
  for (const ch of seed) a = (a * 31 + ch.charCodeAt(0)) >>> 0;
  return a;
};

export function spineColorFor(seed: string, coverHue: number | null | undefined): SpineColor {
  const h = hashOf(seed || '');

  // 표지색이 있으면 그 색상과 가장 가까운 칸, 없으면 제목 해시로 아무 칸.
  // 어느 쪽이든 **팔레트 안의 색**이라 서로 어울린다.
  let idx: number;
  if (coverHue == null) {
    idx = h % PALETTE.length;
  } else {
    const hue = ((coverHue % 360) + 360) % 360;
    idx = 0;
    for (let i = 1; i < PALETTE.length; i++) {
      if (hueGap(PALETTE[i][0], hue) < hueGap(PALETTE[idx][0], hue)) idx = i;
    }
  }

  const [hue, sat, lum] = PALETTE[idx];
  return {
    bg: `hsl(${hue} ${sat}% ${lum}%)`,
    // 62%를 경계로 글자색을 뒤집는다. 이 값보다 밝으면 크림 글씨가 배경에 묻힌다.
    fg: lum > 62 ? '#2A2622' : '#F4EDE0',
    line: lum > 62 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.34)',
    l: lum,
  };
}

/**
 * 표지 이미지에서 '가장 눈에 띄는' 색상을 고른다.
 *
 * 그냥 평균을 내면 안 된다 — 한국 소설 표지는 흰 바탕이 많아 전부 회색이 된다.
 * 무채색·너무 밝거나 어두운 픽셀을 빼고, 남은 픽셀을 15도 단위로 묶어 제일 많은 칸을 쓴다.
 *
 * 표지 호스트(알라딘·오픈라이브러리·Supabase Storage)는 모두 CORS 를 허용한다.
 * 그래도 실패할 수 있으니(네트워크·형식) 실패하면 null 을 준다 — 부르는 쪽은 그냥 두면 된다.
 */
export async function extractCoverHue(url: string): Promise<number | null> {
  if (!url || typeof document === 'undefined') return null;

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = url;
  });
  if (!img) return null;

  try {
    const W = 60, H = 90;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);

    const buckets = new Map<number, number>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      if (l < 0.12 || l > 0.93) continue;                  // 거의 흰색·검정
      const d = max - min;
      if (d === 0) continue;
      const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (s < 0.18) continue;                              // 무채색

      let hh: number;
      if (max === r) hh = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) hh = ((b - r) / d + 2) / 6;
      else hh = ((r - g) / d + 4) / 6;

      const key = Math.round(hh * 24) % 24;                // 15도 단위
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    if (!buckets.size) return null;

    let best = -1, bestN = 0;
    for (const [k, n] of buckets) if (n > bestN) { best = k; bestN = n; }
    // 표지 전체의 2% 도 안 되는 색이면 '주된 색'이라 하기 어렵다
    if (bestN < W * H * 0.02) return null;
    return Math.round((best / 24) * 360) % 360;
  } catch {
    // 캔버스가 오염되면(CORS 헤더 없는 호스트) getImageData 가 던진다
    return null;
  }
}
