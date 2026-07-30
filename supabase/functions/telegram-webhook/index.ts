import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 텔레그램 봇 웹훅.
 * 유저가 앱에서 "텔레그램 알림 받기"를 누르면 t.me/MOAbook_bot?start=CODE 로 봇을 연다.
 * 봇이 받는 /start CODE 를 여기서 처리해 프로필의 telegram_chat_id 를 채운다(=연동).
 */

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET"); // 웹훅 설정 시 지정한 secret_token
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function tgSend(chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  // 텔레그램이 보낸 요청인지 확인 (웹훅 설정 시 secret_token 지정한 경우)
  if (WEBHOOK_SECRET && req.headers.get("x-telegram-bot-api-secret-token") !== WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  let update: any;
  try { update = await req.json(); } catch { return new Response("ok"); }
  const msg = update.message ?? update.edited_message;
  const chatId = msg?.chat?.id;
  const text: string = (msg?.text ?? "").trim();
  if (!chatId || !text) return new Response("ok");

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  if (text.startsWith("/start")) {
    const code = text.split(/\s+/)[1];
    if (!code) {
      await tgSend(chatId, "안녕하세요! 모아북 알림 봇이에요 📚\n모아북 앱 → 프로필 설정에서 <b>텔레그램 알림 받기</b>를 눌러 연동해주세요.");
      return new Response("ok");
    }
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("telegram_link_code", code).maybeSingle();
    if (!profile) {
      await tgSend(chatId, "연동 코드가 만료됐어요. 모아북 앱에서 다시 <b>텔레그램 알림 받기</b>를 눌러주세요.");
      return new Response("ok");
    }
    await supabase.from("profiles")
      .update({ telegram_chat_id: String(chatId), telegram_opt_in: true, telegram_link_code: null })
      .eq("id", profile.id);
    await tgSend(chatId, "🎉 <b>텔레그램 알림이 연결됐어요!</b>\n이제 중요한 소식을 여기로 보내드릴게요. 끄려면 모아북 앱 프로필 설정에서 바꿀 수 있어요.");
    return new Response("ok");
  }

  if (text.startsWith("/stop")) {
    await supabase.from("profiles").update({ telegram_opt_in: false }).eq("telegram_chat_id", String(chatId));
    await tgSend(chatId, "알림을 껐어요. 다시 받으려면 앱에서 켜주세요.");
    return new Response("ok");
  }

  await tgSend(chatId, "모아북 앱 → 프로필 설정에서 <b>텔레그램 알림 받기</b>로 연동해주세요.");
  return new Response("ok");
});
