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
      // 같은 학교 이메일을 다른 계정이 이미 인증했으면 코드 발송 자체를 막는다.
      const { data: takenOnSend } = await admin
        .from('profiles')
        .select('id')
        .eq('school_email', cleanEmail)
        .neq('id', user.id)
        .maybeSingle();
      if (takenOnSend) {
        return json({ error: '이미 다른 계정에서 인증된 학교 이메일이에요.' }, 409);
      }

      const genCode = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error: upErr } = await admin.from('school_email_codes').upsert({
        user_id: user.id, email: cleanEmail, code: genCode, expires_at: expires,
      });
      if (upErr) return json({ error: `db: ${upErr.message}` }, 500);

      // SMTP 발송은 별도 try로 감싸 원인을 구분해 돌려준다(엣지에서 raw SMTP가 막히는 환경 대비).
      try {
        const host = Deno.env.get('SMTP_HOST');
        const smtpUser = Deno.env.get('SMTP_USER');
        const smtpPass = Deno.env.get('SMTP_PASS');
        const sender = Deno.env.get('SMTP_SENDER') || smtpUser;
        if (!host || !smtpUser || !smtpPass) {
          return json({ error: `smtp env missing (host:${!!host} user:${!!smtpUser} pass:${!!smtpPass})` }, 500);
        }
        const smtp = new SMTPClient({
          connection: { hostname: host, port: 465, tls: true, auth: { username: smtpUser, password: smtpPass } },
        });
        await smtp.send({
          from: sender!,
          to: cleanEmail,
          subject: `[MOA] 학교 인증 코드 ${genCode}`,
          content: `MOA 학교 이메일 인증 코드는 ${genCode} 입니다. 10분 안에 입력해주세요.`,
          html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6"><p>MOA 학교 이메일 인증 코드입니다.</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${genCode}</p><p style="color:#666">10분 안에 앱에 입력해주세요. 본인이 요청하지 않았다면 무시하세요.</p></div>`,
        });
        await smtp.close();
      } catch (mailErr) {
        const m = mailErr instanceof Error ? mailErr.message : JSON.stringify(mailErr);
        return json({ error: `메일 발송 실패: ${m}` }, 500);
      }
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
      // 같은 학교 이메일은 한 계정만 인증 가능(계정 삭제 시 값이 사라져 자동 리셋).
      const { data: taken } = await admin
        .from('profiles')
        .select('id')
        .eq('school_email', cleanEmail)
        .neq('id', user.id)
        .maybeSingle();
      if (taken) {
        return json({ error: '이미 다른 계정에서 인증된 학교 이메일이에요.' }, 409);
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
    return json({ error: e instanceof Error ? e.message : `unexpected: ${JSON.stringify(e)}` }, 500);
  }
});
