/**
 * 거래 방식과 가격 표기를 한곳에서 정한다.
 *
 * 이전엔 화면마다 통화가 제각각이었다 — 등록 화면은 "가격 (₩)", 상세 시트는 "S$8",
 * 관심책 목록은 "₩8". 같은 숫자가 화면마다 다른 돈으로 읽혔다.
 * 싱가포르 서비스이므로 S$ 하나로 통일하고, 표기는 전부 여기를 거치게 한다.
 */
export type BookMode = 'rent' | 'sell' | 'give';

export const CURRENCY = 'S$';

/** 돈이 오가는 방식은 판매 하나뿐이다. 대여·나눔은 무료. */
export const isPaid = (mode: BookMode) => mode === 'sell';

export const formatPrice = (price?: number | null): string => {
  if (price == null) return '무료';
  // 소수점은 있을 때만 보여준다 (S$8, S$8.50)
  const n = Number(price);
  return `${CURRENCY}${n % 1 === 0 ? n.toLocaleString() : n.toFixed(2)}`;
};

export const MODE_LABEL: Record<BookMode, string> = {
  rent: '대여',
  sell: '판매',
  give: '나눔',
};

export const MODE_EYEBROW: Record<BookMode, string> = {
  rent: 'FOR RENT',
  sell: 'FOR SALE',
  give: 'GIVEAWAY',
};

/** 상세 시트의 행동 버튼 */
export const MODE_CTA: Record<BookMode, string> = {
  rent: '대여 신청',
  sell: '구매 문의',
  give: '나눔 받기',
};

/** 서가·상세에서 보여주는 상태 문구 */
export const availabilityLabel = (mode: BookMode, price?: number | null): string => {
  if (mode === 'sell') return `판매중 · ${formatPrice(price)}`;
  if (mode === 'give') return '무료 나눔';
  return '대여 가능';
};

/**
 * 나눔은 책이 아예 넘어간다 — 대여처럼 돌려받지 않는다.
 * 거래 기록상으로는 판매와 같은 소유권 이전이라 'purchase'로 남긴다.
 */
export const toTransactionType = (mode: BookMode): 'rent' | 'purchase' =>
  mode === 'rent' ? 'rent' : 'purchase';
