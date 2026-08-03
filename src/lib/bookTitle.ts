// 책 제목 표시용 정리.
// 제목 뒤에 붙는 판형·에디션 수식어를 떼어 책등/카드에서 깔끔하게 보이게 한다.
// 예: "미움받을 용기 (10주년 기념 특별판)" → "미움받을 용기"
//     "데미안 [양장본]" → "데미안"
// ⚠️ 원본(DB)은 그대로 두고 '표시'만 정리한다. 권수·상/하 같은 실제 구분 정보는 남긴다.

// 괄호 안에 이런 낱말이 있으면 '판형/에디션 수식어'로 보고 통째로 제거.
const EDITION_KEYWORDS = [
  '개정판', '개정증보판', '증보판', '전면개정판', '개정',
  '특별판', '한정판', '한정', '스페셜', '에디션', 'edition',
  '양장본', '양장', '무선', '반양장',
  '리커버', '리마스터', '리뉴얼',
  '기념', '주년',
  '초판본', '초판', '복간', '복각',
  '완전판', '오리지널', '디럭스', '합본판',
  '큰글자', '큰글씨',
];

// 트레일링 괄호/대괄호 블록: (…) […] （…） 【…】
const TRAILING_BRACKET = /[\s·,]*[([（【]([^)\]）】]*)[)\]）】][\s.]*$/;

/** 표시용으로 정리된 제목. 원본은 보존. */
export function cleanBookTitle(raw: string | null | undefined): string {
  let t = (raw ?? '').trim();
  if (!t) return '';

  // 트레일링 괄호가 '에디션 수식어'면 반복적으로 제거(여러 개 붙는 경우 대비).
  // 단, 제목이 통째로 사라지는 건 막는다.
  for (let i = 0; i < 3; i++) {
    const m = t.match(TRAILING_BRACKET);
    if (!m) break;
    const inside = m[1] ?? '';
    const isEdition = EDITION_KEYWORDS.some((k) => inside.includes(k));
    if (!isEdition) break;
    const stripped = t.slice(0, m.index).trim();
    if (!stripped) break; // 제목 전체가 괄호뿐이면 그대로 둔다
    t = stripped;
  }

  // 트레일링 " - 개정판" 같은 대시형 수식어도 제거
  const dash = t.match(/\s[-–—]\s*([^-–—]+)$/);
  if (dash && EDITION_KEYWORDS.some((k) => (dash[1] ?? '').includes(k))) {
    const stripped = t.slice(0, dash.index).trim();
    if (stripped) t = stripped;
  }

  return t;
}
