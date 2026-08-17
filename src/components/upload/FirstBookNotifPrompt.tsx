import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookCheck, Send, ChevronDown, Share } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const TELEGRAM_BOT = 'MOAbook_bot';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 첫 책 등록 직후 뜨는 알림 설정 유도.
 * 온보딩에서 알림을 넘겨 읽던 문제 → "방금 올린 책에 대여 요청이 올 수 있다"는 맥락에서 다시 권한다.
 * 1순위: 텔레그램 연동(설치 불필요). 텔레그램을 안 쓰는 사람에게만 홈 화면 추가 안내를 접이식으로.
 */
export const FirstBookNotifPrompt = ({ isOpen, onClose }: Props) => {
  const { user } = useAuth();
  const [showInstall, setShowInstall] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const connectTelegram = async () => {
    if (!user || connecting) return;
    setConnecting(true);
    try {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(9)))
        .map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
      await supabase.from('profiles').update({ telegram_link_code: code }).eq('id', user.id);
      window.open(`https://t.me/${TELEGRAM_BOT}?start=${code}`, '_blank');
      toast.info('텔레그램에서 "시작"을 누르면 연동돼요');
      onClose();
    } finally {
      setConnecting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-sm max-h-[85vh] overflow-y-auto bg-card rounded-2xl shadow-2xl p-6 text-center"
            initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <BookCheck className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display text-[22px] font-medium text-foreground mb-1.5">📚 첫 책 등록 완료!</h3>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              대여 요청을 놓치지 않으려면 알림을 켜세요.
            </p>

            <button
              onClick={connectTelegram}
              disabled={connecting}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <Send className="w-4 h-4" /> 텔레그램으로 알림 받기
            </button>

            <button
              onClick={() => setShowInstall((v) => !v)}
              className="mt-3 mx-auto flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
            >
              텔레그램을 안 쓴다면, 홈 화면에 추가해 앱 알림으로 받기
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showInstall ? 'rotate-180' : ''}`} />
            </button>

            {showInstall && (
              <div className="mt-3 rounded-xl bg-muted/50 p-3 text-left text-[13px] text-muted-foreground leading-relaxed">
                <p className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
                  <Share className="w-4 h-4" /> 홈 화면에 추가 (iPhone)
                </p>
                <p>사파리 하단 <b>공유</b> 버튼 → <b>홈 화면에 추가</b> → 추가.<br />
                홈 화면 아이콘으로 열면 앱처럼 알림을 받을 수 있어요.</p>
              </div>
            )}

            <button onClick={onClose} className="mt-4 w-full h-11 rounded-xl text-muted-foreground text-sm">
              나중에
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
