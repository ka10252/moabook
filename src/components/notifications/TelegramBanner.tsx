import { useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const BOT = 'MOAbook_bot';
const DISMISS_KEY = 'moa_tg_banner_dismissed';

/** 진입 시 텔레그램 알림 수신 동의 배너 (연동 안 한 유저에게 1회). */
export function TelegramBanner() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('telegram_chat_id').eq('id', user.id).maybeSingle();
      if (!(data as { telegram_chat_id?: string | null } | null)?.telegram_chat_id) setShow(true);
    })();
  }, [user]);

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, '1'); setShow(false); };

  const connect = async () => {
    if (!user) return;
    const code = Array.from(crypto.getRandomValues(new Uint8Array(9)))
      .map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
    const { error } = await supabase.from('profiles').update({ telegram_link_code: code }).eq('id', user.id);
    if (error) { toast.error('연동 준비에 실패했어요'); return; }
    window.open(`https://t.me/${BOT}?start=${code}`, '_blank');
    dismiss();
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-[480px]">
      <div className="flex items-center gap-3 rounded-2xl bg-card border border-border shadow-lg px-4 py-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Send className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground leading-tight">텔레그램으로 알림 받기</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">앱 알림을 못 봐도 대여 요청·반납 소식을 놓치지 마세요</p>
        </div>
        <button onClick={connect} className="shrink-0 px-3 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">연동</button>
        <button onClick={dismiss} className="shrink-0 p-1.5 rounded-lg hover:bg-muted" aria-label="닫기">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
