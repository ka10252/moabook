/**
 * 제목·닉네임 같은 문자열에서 책등 색을 결정적으로 뽑는다.
 * 랜덤이면 새로고침마다 색이 바뀌어 "같은 책"이라는 감각이 깨진다.
 */
const SPINE_CLASSES = [
  'bg-book-1',
  'bg-book-2',
  'bg-book-3',
  'bg-book-4',
  'bg-book-5',
  'bg-book-6',
] as const;

export const spineClassFrom = (seed: string): string => {
  const hash = (seed || '').split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return SPINE_CLASSES[hash % SPINE_CLASSES.length];
};
