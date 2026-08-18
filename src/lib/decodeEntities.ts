/**
 * HTML 엔티티를 실제 글자로 되돌린다.
 *
 * 왜 필요한가: 알라딘·구글 도서 API는 제목·저자·소개를 **HTML로 쓰일 것을 전제로**
 * 이스케이프해서 준다. 그래서 『"나는 맞고 너는 틀리다"』가
 * `&quot;나는 맞고 너는 틀리다&quot;` 로 온다.
 * 우리는 이 값을 React 텍스트로 그리므로(=이미 안전하게 이스케이프됨) 엔티티가 그대로 보인다.
 * 게다가 그 상태로 등록하면 **DB에 `&quot;` 가 박혀** 검색·정렬까지 어긋난다.
 *
 * ⚠️ `innerHTML` 로 푸는 흔한 요령은 쓰지 않는다. 외부 API 문자열을 HTML로 해석시키는 것이라
 *    `<img onerror=...>` 가 그대로 실행된다. 여기서는 문자열 치환만 한다.
 */
const NAMED: Record<string, string> = {
  quot: '"',
  apos: "'",
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  nbsp: ' ',
  lt: '<',
  gt: '>',
  // amp 는 마지막에 따로 푼다 — `&amp;quot;` 같은 이중 인코딩을 한 번에 풀지 않기 위해서다.
};

export function decodeEntities(input: string): string {
  if (!input || input.indexOf('&') === -1) return input;

  const once = (s: string) =>
    s
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
      .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m)
      .replace(/&amp;/gi, '&');

  // 이중 인코딩(`&amp;quot;`)까지만 푼다. 무한히 풀면 원문에 있던 `&amp;` 를 잡아먹는다.
  const first = once(input);
  return first.indexOf('&') === -1 ? first : once(first);
}
