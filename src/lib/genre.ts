/**
 * 책 장르 — 필터용 분류.
 *
 * 설계 기준
 *  · **11칸으로 고정한다.** 알라딘 분류를 그대로 쓰면 40칸이 넘어 필터로 못 쓴다.
 *    한인 커뮤니티 책 공유에 실제로 올라오는 결을 기준으로 묶었다.
 *  · 지금 서가에 없는 칸(어학·수험, 어린이·청소년 등)도 미리 둔다.
 *    나중에 그런 책이 올라올 때 표를 고치지 않아도 되게.
 *  · 필터에는 **책이 한 권이라도 있는 장르만** 띄운다. 빈 칸까지 늘어놓으면
 *    고를 게 없는 버튼만 화면을 먹는다.
 */
export const GENRES = [
  '소설·시',
  '에세이',
  '인문·역사',
  '사회·정치',
  '경제·경영',
  '자기계발',
  '과학·IT',
  '취미·라이프',
  '어학·수험',
  '어린이·청소년',
  '기타',
] as const;

export type Genre = (typeof GENRES)[number];

export const UNKNOWN_GENRE: Genre = '기타';

/**
 * 알라딘 categoryName → 우리 장르.
 *
 * categoryName은 `국내도서>소설/시/희곡>세계의 소설>독일소설` 같은 경로 문자열이다.
 * 위에서부터 훑어 **처음 걸리는 규칙**을 쓰므로, 좁은 분류를 먼저 둔다
 * (예: '컴퓨터'가 '자기계발'보다 앞이어야 IT 실용서가 자기계발로 새지 않는다).
 */
const CATEGORY_RULES: [RegExp, Genre][] = [
  // ── 순서가 규칙의 일부다. 넓은 낱말이 좁은 것을 잡아먹지 않게 좁은 것을 위에 둔다.
  //    실제로 겪은 사고: `과학` 이 **사회과학**에 걸려 『자유론』이 과학·IT가 됐다.
  //    영어(구글 도서 categories)도 같은 표에서 처리한다 — 싱가포르라 영어책이 계속 들어온다.
  [/어린이|유아|청소년|Juvenile|Young Adult/i, '어린이·청소년'],
  [/외국어|수험서|자격증|초등학습|중고등학습|Foreign Language|Study Aids/i, '어학·수험'],

  // 대학교재는 그 자체로 장르가 아니다. 뒤에 붙는 계열을 봐야 한다.
  [/대학교재[^>]*>?[^>]*(경상|경영|경제)/, '경제·경영'],
  [/대학교재[^>]*>?[^>]*(공학|자연과학|컴퓨터)/, '과학·IT'],
  [/대학교재[^>]*>?[^>]*(인문|어문)/, '인문·역사'],

  [/컴퓨터|모바일|IT전문서|Computers|Technology/i, '과학·IT'],
  [/경제경영|재테크|투자|Business|Economics/i, '경제·경영'],
  [/자기계발|Self-?Help/i, '자기계발'],

  // 사회과학이 `과학`보다 반드시 위에 있어야 한다.
  [/사회과학|정치|법률|Political|Social Science/i, '사회·정치'],
  [/과학|공학|의학|Science|Mathematics/i, '과학·IT'],

  [/소설|희곡|장르소설|Fiction|Poetry|Drama/i, '소설·시'],
  [/에세이|Essays?|Biography|Literary Collections/i, '에세이'],
  [/인문학|역사|종교|철학|History|Philosophy|Religion/i, '인문·역사'],
  [/예술|대중문화|만화|여행|요리|살림|건강|취미|레저|가정|육아|반려|Art|Travel|Cooking|Health|Sports|Crafts|Family|Comics/i, '취미·라이프'],
];

/**
 * 알라딘 분류가 없는 책(영어권 검색 결과·직접 입력)을 위한 최후의 짐작.
 * 제목·소개에 뚜렷한 낱말이 있을 때만 쓴다 — 애매하면 '기타'로 두고
 * **등록 화면에서 사람이 고치게** 한다. 잘못 찍어두는 것보다 비워두는 게 낫다.
 */
const KEYWORD_RULES: [RegExp, Genre][] = [
  [/파이썬|python|프로그래밍|코딩|데이터|알고리즘|IT |인공지능|\bAI\b|컴퓨터|통계/i, '과학·IT'],
  [/주식|투자|경제|경영|마케팅|재테크|부동산|스타트업|economics|business/i, '경제·경영'],
  [/토익|toeic|토플|ielts|회화|문법|단어장|기출/i, '어학·수험'],
  [/소설|novel|시집|poems?\b/i, '소설·시'],
  [/에세이|essays?\b/i, '에세이'],
  [/역사|철학|history|philosophy|종교|성경|기독교|불교/i, '인문·역사'],
  [/정치|사회|politics|society/i, '사회·정치'],
  [/습관|성공|자기계발|mindset|habits?\b/i, '자기계발'],
  [/여행|요리|레시피|운동|건강|육아|travel|cook/i, '취미·라이프'],
];

/** 문자열이 우리가 아는 장르인지 */
export const isGenre = (v: unknown): v is Genre =>
  typeof v === 'string' && (GENRES as readonly string[]).includes(v);

/**
 * 책 하나의 장르를 정한다.
 * 알라딘 분류가 있으면 그걸 믿고, 없으면 제목·소개에서 짐작하고, 그래도 모르면 '기타'.
 */
export function classifyGenre(input: {
  categoryName?: string | null;
  title?: string | null;
  description?: string | null;
}): Genre {
  const cat = input.categoryName ?? '';
  if (cat) {
    for (const [re, genre] of CATEGORY_RULES) if (re.test(cat)) return genre;
  }
  const text = `${input.title ?? ''} ${input.description ?? ''}`;
  if (text.trim()) {
    for (const [re, genre] of KEYWORD_RULES) if (re.test(text)) return genre;
  }
  return UNKNOWN_GENRE;
}
