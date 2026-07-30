import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * notifications 에 행이 생기면 DB 트리거가 이 함수를 호출한다.
 * 텔레그램으로는 "행동 필요 + 시간 민감" Tier1 알림만, 그리고
 * 앱 미설치(=활성 푸시 구독 없음) + 텔레그램 동의한 유저에게만 보낸다.
 */

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TRIGGER_SECRET = Deno.env.get("TELEGRAM_TRIGGER_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE = Deno.env.get("SITE_URL") ?? "https://moabook.vercel.app";

// 텔레그램으로 보낼 알림 타입 (Tier1) + 이모지 + 링크 목적지
const TIER1: Record<string, { emoji: string; link: (d: Record<string, unknown>) => string }> = {
  book_request:       { emoji: "📚", link: () => "/?chat=1" },
  request_accepted:   { emoji: "✅", link: () => "/?chat=1" },
  return_due:         { emoji: "⏰", link: () => "/?tab=shelf&tx=1" },
  return_overdue:     { emoji: "🔴", link: () => "/?tab=shelf&tx=1" },
  waitlist_available: { emoji: "🎉", link: (d) => `/?tab=shelf&book=${d.book_id ?? ""}` },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true });
  if (!TRIGGER_SECRET || req.headers.get("x-tg-secret") !== TRIGGER_SECRET) return json({ error: "unauthorized" }, 401);

  const n = await req.json().catch(() => null) as
    | { user_id: string; type: string; title: string; body?: string; data?: Record<string, unknown> } | null;
  if (!n?.user_id || !n?.type) return json({ error: "bad payload" }, 400);

  const spec = TIER1[n.type];
  if (!spec) return json({ skipped: "not tier1" });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // 수신자: 텔레그램 동의 + chat_id 있음
  const { data: profile } = await supabase
    .from("profiles").select("telegram_chat_id, telegram_opt_in").eq("id", n.user_id).maybeSingle();
  if (!profile?.telegram_opt_in || !profile.telegram_chat_id) return json({ skipped: "not opted-in" });

  // 앱 미설치에게만: 활성 푸시 구독이 있으면(=앱/푸시 사용) 텔레그램은 건너뛴다
  const { count } = await supabase
    .from("push_subscriptions").select("endpoint", { count: "exact", head: true }).eq("user_id", n.user_id);
  if ((count ?? 0) > 0) return json({ skipped: "has push" });

  const link = `${SITE}${spec.link(n.data ?? {})}`;
  const text =
    `${spec.emoji} <b>${esc(n.title)}</b>` +
    (n.body ? `\n${esc(n.body)}` : "") +
    `\n\n<a href="${link}">모아북에서 열기</a>`;

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: profile.telegram_chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  return json({ sent: res.ok });
});
