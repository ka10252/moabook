/**
 * 책 상태 — 화면에는 알파벳을 쓰지 않는다.
 *
 * 예전엔 S·A·B를 그대로 보여줬는데, 유저에게 "딱히 의미 부여하는 바가 없음"이었다.
 * 등급 문자는 파는 사람 머릿속에만 있는 기준이라, 보는 사람은 A가 좋은 건지
 * 중간인 건지 알 수 없다. 그래서 문구만 남기고 알파벳은 지웠다.
 *
 * DB 값(S/A/B/C)은 그대로 둔다. 이미 올라간 책이 전부 이 값으로 저장돼 있고,
 * 화면 문구는 언제든 바꿔도 데이터는 건드릴 일이 없는 편이 낫다.
 */
export type BookCondition = 'S' | 'A' | 'B' | 'C';

export interface ConditionMeta {
  value: BookCondition;
  /** 화면에 그대로 나가는 문구 */
  label: string;
  /** 눈금 칸 수 (전체 4칸 중) */
  level: number;
  /** 초록(좋음) / 주황(참고) 색 갈림 */
  good: boolean;
}

export const CONDITION_LEVELS = 4;

export const CONDITIONS: ConditionMeta[] = [
  { value: 'S', label: '새 책', level: 4, good: true },
  { value: 'A', label: '양호', level: 3, good: true },
  { value: 'B', label: '보통', level: 2, good: false },
  { value: 'C', label: '사용감 많음', level: 1, good: false },
];

const BY_VALUE = new Map(CONDITIONS.map((c) => [c.value, c]));

/** 모르는 값이 와도 화면이 비지 않도록 '양호'로 떨어뜨린다 */
export const conditionMeta = (value: string | null | undefined): ConditionMeta =>
  BY_VALUE.get(value as BookCondition) ?? BY_VALUE.get('A')!;

export const conditionLabel = (value: string | null | undefined): string =>
  conditionMeta(value).label;
