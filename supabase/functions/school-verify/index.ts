// 학교 이메일 인증 — 가입 이메일과 별개로 학교 이메일에 6자리 코드를 보내 인증한다.
//   POST { action: 'send',    email }        → 학교 이메일로 코드 발송
//   POST { action: 'confirm', email, code }  → 코드 확인 → profiles.school 세팅
//
// 필요 시크릿(Supabase Functions secrets): SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_SENDER
//   (+ 기본 제공: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { action, email, code } = await req.json();
    const cleanEmail = String(email ?? '').trim().toLowerCase();

    // 학교 도메인 검증(allowlist는 DB의 school_from_email 재사용 → 단일 진실)
    const { data: schoolName } = await admin.rpc('school_from_email', { p_email: cleanEmail });
    if (!schoolName) {
      return json({ error: '싱가포르 대학 이메일이 아니에요. 학교 이메일로 다시 시도해주세요.' }, 400);
    }

    if (action === 'send') {
      const genCode = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error: upErr } = await admin.from('school_email_codes').upsert({
        user_id: user.id, email: cleanEmail, code: genCode, expires_at: expires,
      });
      if (upErr) throw upErr;

      const smtp = new SMTPClient({
        connection: {
          hostname: Deno.env.get('SMTP_HOST')!,
          port: 465,
          tls: true,
          auth: { username: Deno.env.get('SMTP_USER')!, password: Deno.env.get('SMTP_PASS')! },
        },
      });
      await smtp.send({
        from: Deno.env.get('SMTP_SENDER')!,
        to: cleanEmail,
        subject: `[MOA] 학교 인증 코드 ${genCode}`,
        content: `MOA 학교 이메일 인증 코드는 ${genCode} 입니다. 10분 안에 입력해주세요.`,
        html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6">
          <p>MOA 학교 이메일 인증 코드입니다.</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:4px">${genCode}</p>
          <p style="color:#666">10분 안에 앱에 입력해주세요. 본인이 요청하지 않았다면 무시하세요.</p></div>`,
      });
      await smtp.close();
      return json({ ok: true });
    }

    if (action === 'confirm') {
      const { data: row } = await admin
        .from('school_email_codes')
        .select('email, code, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!row || row.email !== cleanEmail || row.code !== String(code ?? '').trim()) {
        return json({ error: '코드가 올바르지 않아요.' }, 400);
      }
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return json({ error: '코드가 만료됐어요. 다시 받아주세요.' }, 400);
      }
      const { error: updErr } = await admin.from('profiles').update({
        school: schoolName,
        school_email: cleanEmail,
        school_verified_at: new Date().toISOString(),
      }).eq('id', user.id);
      if (updErr) throw updErr;
      await admin.from('school_email_codes').delete().eq('user_id', user.id);
      return json({ school: schoolName });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
