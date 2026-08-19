/**
 * 표지에서 책등 색을 만든다.
 *
 * 규칙 하나만 기억하면 된다: **색상(H)만 표지에서 가져오고, 채도·명도는 우리가 정한다.**
 * 표지색을 통째로 쓰면 탁한 표지가 탁한 책등이 되어 지금과 달라지는 게 없고,
 * 밝은 표지에서는 크림색 제목이 사라진다.
 */

/**
 * 책등 팔레트 — 8색.
 *
 * 원래 쓰던 더스티 6색이 출발점이다. 그 결의 핵심은 **채도가 색마다 제각각**이라는 것 —
 * 자두 8%, 남색 17%, 황토 32%. 한 값으로 통일하면 인공적으로 보인다.
 * 그 비율은 그대로 두고 채도를 일괄 75%로 낮춰 파스텔 쪽으로 옮긴 뒤,
 * **명도는 색마다 흰 글씨가 읽히는 한계까지** 올렸다(대비 4.5). 그게 가장 파스텔한 지점이다.
 *
 * ⚠️ **노랑은 없다.** 노랑은 화면 밝기 계산에서 가장 밝은 색이라
 *    (초록 0.72 + 빨강 0.21 의 합) 흰 글씨 4.5 를 맞추려면 명도가 39% 아래여야 하고,
 *    그 밝기의 노랑은 겨자·갈색으로 보인다. **파스텔 노랑과 흰 글씨는 같이 가질 수 없다.**
 *    → 노란 표지 책은 가장 가까운 **황토** 칸으로 간다.
 *
 * ⚠️ 녹색은 바다이끼(158°)와 청록(186°) 둘뿐이다. 예전엔 이끼(104°)까지 셋이었는데
 *    채도가 모두 낮아 서로 구분되지 않았다.
 *
 * 색을 더하거나 고칠 때는 **흰 글씨 대비 4.5 를 반드시 확인할 것** — 아래 표의 명도는
 * 눈대중이 아니라 그 조건에서 계산한 한계값이다.
 */
const PALETTE: readonly [number, number, number][] = [
  [6, 27, 50],    // 벽돌
  [33, 32, 43],   // 황토 — 노란 표지도 여기로 온다
  [330, 15, 49],  // 모브
  [281, 8, 48],   // 자두
  [250, 14, 51],  // 인디고
  [213, 17, 48],  // 남색
  [186, 16, 43],  // 청록
  [158, 24, 40],  // 바다이끼
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
  // 어느 쪽이든 팔레트 안의 색이라 서로 어울린다.
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
    // 팔레트 전체가 흰 글씨 기준(대비 4.5)으로 맞춰져 있다 — 분기가 필요 없다.
    fg: '#FFFFFF',
    line: 'rgba(255,255,255,.38)',
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
