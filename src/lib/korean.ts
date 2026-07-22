/**
 * 한국어 조사 선택.
 *
 * "대여을(를) 요청합니다" 같은 표기는 유저에게 "이건 기계가 쓴 문장"이라고 광고하는 것과 같다.
 * 받침이 있으면 '을', 없으면 '를'을 쓴다.
 *
 * 한글 음절은 유니코드 0xAC00부터 (초성×588 + 중성×28 + 종성) 순으로 배열되므로,
 * (코드 - 0xAC00) % 28 이 0이면 종성(받침)이 없다.
 *
 * DB 쪽에도 같은 규칙의 ko_particle() 함수가 있다 (알림 문구용).
 */
const hasBatchim = (word: string): boolean => {
  const trimmed = (word ?? '').trim();
  if (!trimmed) return false;

  const code = trimmed.charCodeAt(trimmed.length - 1);
  // 한글 음절 범위 밖(영어·숫자)이면 판정할 수 없다. 더 흔한 쪽(받침 없음)으로 둔다.
  if (code < 0xac00 || code > 0xd7a3) return false;

  return (code - 0xac00) % 28 !== 0;
};

/** 목적격 조사: 대여 → "를", 나눔 → "을" */
export const objectParticle = (word: string) => (hasBatchim(word) ? '을' : '를');

/** 주격 조사: 책 → "이", 대여 → "가" */
export const subjectParticle = (word: string) => (hasBatchim(word) ? '이' : '가');

/** 주제 조사: 책 → "은", 대여 → "는" */
export const topicParticle = (word: string) => (hasBatchim(word) ? '은' : '는');
