import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// 알라딘 TTB 키. 브라우저에 노출되면 안 되므로 Edge Function Secret에만 둔다.
// (VITE_ 로 프론트에 넣으면 배포 코드에 그대로 박혀 누구나 볼 수 있고, 하루 5,000회 한도를 태울 수 있다)
const TTB_KEY = Deno.env.get("ALADIN_TTB_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** 알라딘 응답 → 앱의 BookSearchResult 포맷. 프론트가 API 종류를 몰라도 되게 여기서 통일한다. */
interface AladinItem {
  title: string;
  author: string;
  cover: string;
  description: string;
  isbn13: string;
  pubDate: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 키가 없으면 성공한 척하지 않는다. 조용히 빈 결과를 주면 "왜 한국 책이 안 나오지"로 헤맨다.
  if (!TTB_KEY) {
    console.error("ALADIN_TTB_KEY is not set");
    return json({ error: "not_configured", results: [] }, 500);
  }

  let query = "";
  try {
    const body = await req.json();
    query = (body?.query ?? "").toString().trim();
  } catch {
    return json({ error: "invalid_body", results: [] }, 400);
  }

  if (query.length < 2) return json({ results: [] });

  // 알라딘 상품 검색 API. output=js 면 JSON, cover=Big 이면 큰 표지를 준다.
  const url =
    `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx` +
    `?ttbkey=${TTB_KEY}` +
    `&Query=${encodeURIComponent(query)}` +
    `&QueryType=Keyword` +
    `&MaxResults=10` +
    `&start=1` +
    `&SearchTarget=Book` +
    `&Cover=Big` +
    `&output=js` +
    `&Version=20131101`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Aladin API error", res.status);
      return json({ error: "aladin_error", results: [] }, 502);
    }

    // 알라딘은 가끔 application/json 이 아닌 text로 주기도 해서 직접 파싱한다.
    const text = await res.text();
    let data: { item?: AladinItem[]; errorMessage?: string };
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Aladin returned non-JSON:", text.slice(0, 200));
      return json({ error: "parse_error", results: [] }, 502);
    }

    // 잘못된 키 등은 errorMessage로 온다 (HTTP는 200이면서).
    if (data.errorMessage) {
      console.error("Aladin errorMessage:", data.errorMessage);
      return json({ error: "aladin_error", results: [] }, 502);
    }

    const results = (data.item ?? []).map((it) => ({
      // 알라딘 결과임을 알 수 있게 isbn 기반 key. fetchBookDetails가 이걸로 분기한다.
      key: it.isbn13 ? `aladin:${it.isbn13}` : `aladin:${it.title}`,
      title: it.title ?? "",
      // 알라딘 저자는 "헤르만 헤세 (지은이), 전영애 (옮긴이)" 형태다.
      // 첫 저자만, "(지은이)" 같은 역할 표기는 떼어낸다.
      author: (it.author ?? "").split(",")[0].replace(/\s*\([^)]*\)\s*$/, "").trim() || "저자 미상",
      // 표지 URL을 https로 강제 (알라딘이 http로 줄 때가 있다)
      cover: it.cover ? it.cover.replace("http:", "https:") : null,
      description: it.description || null,
      firstPublishYear: it.pubDate ? parseInt(it.pubDate.slice(0, 4)) : undefined,
      isbn: it.isbn13 || undefined,
    }));

    return json({ results });
  } catch (err) {
    console.error("aladin-search failed:", err);
    return json({ error: "fetch_failed", results: [] }, 502);
  }
});
