import { useEffect, useState } from 'react';
import { Send, Check, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const BOT = 'MOAbook_bot';

/** 앱 미설치·푸시 못 받는 유저를 위한 텔레그램 알림 연동. */
export function TelegramSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [optIn, setOptIn] = useState(false);
  // 연동 시도 후 안내용 코드. 폰에서 텔레그램이 자동으로 안 열려도 이 코드로 수동 연결.
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    // telegram_chat_id는 base에서 회수됨 → 본인 비공개 필드는 RPC로.
    const { data } = await supabase.rpc('get_my_private_profile' as any);
    const row = data as { telegram_linked?: boolean; telegram_opt_in?: boolean } | null;
    setLinked(!!row?.telegram_linked);
    setOptIn(!!row?.telegram_opt_in);
    if (row?.telegram_linked) setPendingCode(null); // 연동 완료되면 안내 감춤
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // 탭 복귀 시(텔레그램 다녀온 뒤) 연동 상태 갱신
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async () => {
    if (!user) return;
    const code = Array.from(crypto.getRandomValues(new Uint8Array(9)))
      .map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
    const { error } = await supabase.from('profiles').update({ telegram_link_code: code }).eq('id', user.id);
    if (error) { toast.error('연동 준비에 실패했어요'); return; }
    // 폰에서는 팝업 차단·앱 미설치로 자동으로 안 열릴 수 있다 → 항상 수동 안내 코드를 남긴다.
    setPendingCode(code);
    const w = window.open(`https://t.me/${BOT}?start=${code}`, '_blank');
    if (w) toast.info('텔레그램에서 "시작"을 누르면 연동돼요');
    else toast.info('텔레그램이 안 열리면 아래 안내대로 연결해주세요');
  };

  const toggle = async (v: boolean) => {
    if (!user) return;
    setOptIn(v);
    const { error } = await supabase.from('profiles').update({ telegram_opt_in: v }).eq('id', user.id);
    if (error) { setOptIn(!v); toast.error('설정을 바꾸지 못했어요'); }
  };

  const disconnect = async () => {
    if (!user) return;
    const { error } = await supabase.from('profiles')
      .update({ telegram_chat_id: null, telegram_opt_in: false, telegram_link_code: null }).eq('id', user.id);
    if (error) { toast.error('연결 해제에 실패했어요'); return; }
    setLinked(false); setOptIn(false);
    toast.success('텔레그램 연결을 해제했어요');
  };

  if (loading) return null;

  return (
    <div className="mt-3 rounded-[14px] border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[15px] font-bold text-foreground">
          <Send className="w-4 h-4 text-primary" />
          텔레그램 알림
        </div>
        {linked && <Switch checked={optIn} onCheckedChange={toggle} />}
      </div>
      <p className="text-[13px] text-muted-foreground">
        앱 알림을 못 받아도, 대여 요청·수락·반납 임박 같은 중요한 소식을 텔레그램으로 받아보세요.
      </p>
      {linked ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[15px] font-medium text-primary">
            <Check className="w-4 h-4" /> 연결됨 {optIn ? '' : '(알림 꺼짐)'}
          </div>
          <button onClick={disconnect} className="text-[15px] text-muted-foreground underline underline-offset-2">
            연결 해제
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={connect}
            className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-[15px] font-semibold flex items-center justify-center gap-1.5"
          >
            <Send className="w-4 h-4" /> 텔레그램으로 연동하기
          </button>

          {/* 자동 연결 실패 대비 수동 안내 — 연동 시도 후에만 노출 */}
          {pendingCode && (
            <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-2 text-[13px]">
              <p className="font-semibold text-foreground">텔레그램이 안 열렸나요?</p>
              <p className="text-muted-foreground leading-relaxed">
                텔레그램 앱에서 <span className="font-medium text-foreground">@{BOT}</span> 을 검색해 열고,
                아래 코드를 붙여넣어 보내면 연결돼요.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all rounded-lg bg-background border border-border px-2.5 py-1.5 font-mono text-[13px] text-foreground break-all">
                  /start {pendingCode}
                </code>
                <button
                  onClick={() => { navigator.clipboard?.writeText(`/start ${pendingCode}`); toast.success('코드를 복사했어요'); }}
                  className="shrink-0 h-8 px-3 rounded-lg border border-border text-[13px] font-medium hover:bg-muted"
                >
                  복사
                </button>
              </div>
              <button
                onClick={() => window.open(`https://t.me/${BOT}?start=${pendingCode}`, '_blank')}
                className="text-[13px] text-primary underline underline-offset-2"
              >
                텔레그램 다시 열기
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
