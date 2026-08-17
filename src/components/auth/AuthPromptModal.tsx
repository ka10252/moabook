import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, MessageCircle, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGuestGate } from '@/hooks/useGuestGate';
import { useBackClose } from '@/hooks/useBackClose';

/**
 * 게스트가 3번 둘러봤거나, 로그인이 필요한 동작을 시도했을 때 뜨는 가입 권유.
 * 닫을 수 있게 둔다 — 강제로 막으면 "그래서 이게 뭔데?"를 못 본 채 이탈한다.
 */
export const AuthPromptModal = () => {
  const { showAuthPrompt, promptReason, closeAuthPrompt } = useGuestGate();
  const navigate = useNavigate();
  const location = useLocation();

  // 뒤로가기로도 닫힌다
  useBackClose(showAuthPrompt, closeAuthPrompt);

  const goAuth = (mode: 'signup' | 'signin') => {
    closeAuthPrompt();
    // 텔레그램/알림 딥링크(?chat=1 등)로 들어와 로그인을 요구받은 경우,
    // 지금 있던 화면을 기억해뒀다 로그인 후 그대로 돌려보낸다. (/auth 자신은 제외)
    const here = location.pathname + location.search;
    const redirect = location.pathname === '/auth' ? '' : `&redirect=${encodeURIComponent(here)}`;
    navigate(`/auth?mode=${mode}${redirect}`);
  };

  return (
    <AnimatePresence>
      {showAuthPrompt && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-foreground/45 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAuthPrompt}
        >
          <motion.div
            className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-card p-6 pb-8"
            style={{ borderRadius: 'var(--sheet-radius) var(--sheet-radius) 0 0' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="eyebrow">{promptReason === 'page' ? 'MEMBERS ONLY' : 'JOIN MOA BOOK'}</p>
                <h2 className="font-display text-[30px] leading-tight text-foreground mt-1">
                  {promptReason === 'page'
                    ? '로그인이 필요한 화면이에요'
                    : promptReason === 'action'
                      ? '로그인하고 이어가세요'
                      : '마음에 드는 책, 찾으셨나요?'}
                </h2>
              </div>
              <button
                onClick={closeAuthPrompt}
                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              {promptReason === 'page'
                ? '이 화면은 회원만 볼 수 있어요.'
                : promptReason === 'action'
                  ? '이 기능은 회원만 이용할 수 있어요.'
                  : '가입하면 이웃의 책을 빌리고, 내 책도 나눌 수 있어요.'}
            </p>

            {/* 혜택 나열은 아직 서비스를 모르는 사람(둘러보기 권유)에게만 필요하다.
                이미 등록·대여를 하려던 사람에게는 설득이 아니라 로그인 버튼이 필요하다. */}
            {promptReason === 'browse' && (
              <ul className="space-y-2.5 mb-6">
                <Benefit icon={<BookOpen className="w-4 h-4" />} text="이웃의 책 빌리기 · 사기" />
                <Benefit icon={<MessageCircle className="w-4 h-4" />} text="책 주인과 바로 채팅" />
                <Benefit icon={<Heart className="w-4 h-4" />} text="관심 책 저장하고 알림 받기" />
              </ul>
            )}

            <div className="space-y-2.5">
              <Button
                onClick={() => goAuth('signup')}
                className="w-full h-12 rounded-full text-base font-semibold"
              >
                30초 만에 가입하기
              </Button>
              <Button
                variant="outline"
                onClick={() => goAuth('signin')}
                className="w-full h-12 rounded-full text-base font-semibold"
              >
                이미 계정이 있어요
              </Button>
              <button
                onClick={closeAuthPrompt}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                더 둘러볼게요
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Benefit = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <li className="flex items-center gap-2.5 text-sm text-foreground">
    <span className="w-8 h-8 rounded-full bg-primary/12 text-primary flex items-center justify-center shrink-0">
      {icon}
    </span>
    {text}
  </li>
);
