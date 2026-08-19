/**
 * 표지에서 책등 색을 만든다.
 *
 * 규칙 하나만 기억하면 된다: **색상(H)만 표지에서 가져오고, 채도·명도는 우리가 정한다.**
 * 표지색을 통째로 쓰면 탁한 표지가 탁한 책등이 되어 지금과 달라지는 게 없고,
 * 밝은 표지에서는 크림색 제목이 사라진다.
 */

/**
 * 책등 팔레트 — 원래 쓰던 더스티 6색.
 *
 * 표지색에서 색을 만드는 안(파스텔·안개·쨍한 톤 등)을 여러 번 시도했지만
 * 결국 **이 팔레트가 가장 낫다**는 결론이었다. 그 결의 핵심은
 * **채도가 색마다 제각각**이라는 것 — 자두 11%, 이끼 14%, 황토 42%.
 * 한 값으로 통일한 안들은 모두 인공적으로 보였다.
 *
 * 색을 고르는 방식도 원래대로 **제목 해시**다. 표지색(`books.cover_hue`)은
 * DB에 남아 있지만 지금은 쓰지 않는다 — 다시 쓰고 싶으면 아래 주석을 참고할 것.
 *
 * ⚠️ 글씨는 크림(#F4EDE0)이다. 황토(명도 53%)는 대비가 3.0 으로 낮은 편이라
 *    가장 먼저 흐려지는 자리다. 색을 손볼 일이 생기면 여기부터 본다.
 */
const PALETTE: readonly [number, number, number][] = [
  [6, 36, 45],    // 벽돌
  [213, 22, 39],  // 남색
  [104, 14, 42],  // 이끼
  [33, 42, 53],   // 황토
  [281, 11, 46],  // 자두
  [186, 21, 39],  // 청록
];

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

export function spineColorFor(seed: string, _coverHue?: number | null): SpineColor {
  // 표지색은 쓰지 않는다(위 주석 참고). 제목 해시로 고른다 — 새로고침해도 같은 책은 같은 색이다.
  const [hue, sat, lum] = PALETTE[hashOf(seed || '') % PALETTE.length];
  return {
    bg: `hsl(${hue} ${sat}% ${lum}%)`,
    fg: '#F4EDE0',
    line: 'rgba(255,255,255,.30)',
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
