import { useState, useEffect, useLayoutEffect, useCallback, useRef, ReactNode } from 'react';
import { track } from '@/lib/analytics';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Bell, Upload, Plus, Check, Sparkles, ChevronRight, BookOpen, Clock, MessageCircle, Send, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications, pushResultMessage } from '@/hooks/usePushNotifications';
import { needsHomeScreenInstall } from '@/lib/platform';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const TELEGRAM_BOT = 'MOAbook_bot';

interface OnboardingModalProps {
  onComplete: () => void;
}

/** 스포트라이트가 대상 주위로 남길 여백 */
const HALO = 10;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * 온보딩은 "설명서"가 아니라 "안내"다.
 * 그래서 별도 팝업으로 앱을 가리지 않고, 실제 화면 위에 스포트라이트를 얹어
 * 지금 말하는 그 요소(서가·알림 버튼·등록 탭)를 직접 가리킨다.
 * 유저가 나중에 스스로 찾아야 할 것을, 지금 눈으로 보게 만드는 게 목적이다.
 */
export const OnboardingModal = ({ onComplete }: OnboardingModalProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const { isPushSupported, permission, requestAndSubscribe, loading: pushLoading } =
    usePushNotifications();
  const [pushDone, setPushDone] = useState(false);
  // 알림 스텝 내부 하위 화면: 옵션 선택 → 홈화면 추가 안내 / 텔레그램 안내
  const [pushView, setPushView] = useState<'main' | 'install' | 'telegram'>('main');
  const [showLater, setShowLater] = useState(false);
  // ?ios=1 → 데스크톱에서도 iOS 안내 화면을 미리 볼 수 있다 (검수용)
  const forceIOS =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('ios');
  const iosNeedsInstall = forceIOS || needsHomeScreenInstall();
  const isBlocked = permission === 'denied';

  const handleEnablePush = async () => {
    const result = await requestAndSubscribe();
    if (result === 'granted') {
      setPushDone(true);
      toast.success(pushResultMessage(result));
    } else {
      // 실패 사유를 그대로 알린다 — "거부됨" 한 마디로는 유저가 뭘 해야 할지 모른다
      toast.error(pushResultMessage(result));
    }
  };

  /** 홈 화면 추가·알림 버튼: iOS 미설치면 설치 안내로, 그 외엔 바로 권한 요청 */
  const handlePrimaryPush = () => {
    if (iosNeedsInstall) setPushView('install');
    else handleEnablePush();
  };

  /** 텔레그램 연동: 링크코드 만들고 봇을 연다. 자동 연동이 안 될 때를 대비해 안내 화면도 함께 보여준다. */
  const handleTelegram = async () => {
    if (user) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(9)))
        .map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
      await supabase.from('profiles').update({ telegram_link_code: code }).eq('id', user.id);
      window.open(`https://t.me/${TELEGRAM_BOT}?start=${code}`, '_blank');
    }
    setPushView('telegram');
  };

  /** target: 실제 화면에서 조준할 요소. 없으면 화면 가운데 카드로 뜬다. */
  const steps: { key: string; target?: string; render: () => ReactNode }[] = [
    // ① 이 앱이 뭔지 — 기능이 아니라 공감부터. 조준할 대상 없이 가운데 모달.
    {
      key: 'intro',
      render: () => (
        <>
          <ShelfArt />
          <h2 className="font-display text-[30px] leading-tight text-foreground">
            싱가포르에서
            <br />
            한글책 구하기 어렵죠?
          </h2>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            MOA Book에서는 <b className="text-foreground">이웃의 책장</b>을 열어
            <br />
            서로 책을 빌려주고 나눠줄 수 있어요.
          </p>
        </>
      ),
    },

    // ② 빌리는 법 — 실제 서가를 비추면서, 탭하면 뜨는 화면까지 미리 보여준다
    {
      key: 'borrow',
      target: '[data-onboarding="shelf"]',
      render: () => (
        <>
          <p className="eyebrow">책 빌리기</p>
          <h2 className="font-display text-[22px] leading-tight text-foreground">
            책등을 탭해서 정보를 확인해요
          </h2>

          <BorrowDemo />

          <ol className="w-full space-y-2 text-left">
            <StepRow n={1} title="책등을 탭" />
            <StepRow n={2} title="대여 신청" />
            <StepRow n={3} title="채팅으로 약속 잡기" />
            <StepRow n={4} title="만나서 받기" accent />
          </ol>
        </>
      ),
    },

    // ③ 올리는 법 — 하단 '등록' 탭을 직접 가리킨다
    {
      key: 'upload',
      target: '[data-onboarding="nav-upload"]',
      render: () => (
        <>
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-full bg-primary/12 flex items-center justify-center shrink-0">
              <Upload className="w-[18px] h-[18px] text-primary" />
            </span>
            <h2 className="font-display text-[22px] leading-tight text-foreground">
              책은 여기서 올려요
            </h2>
          </div>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            제목만 검색하면 표지·저자가 자동으로 채워져요. 거래 방식(대여·판매·나눔)과 상태만 고르면 끝.
          </p>
        </>
      ),
    },

    // ④ 커뮤니티 — 하단 '커뮤니티' 탭을 가리킨다.
    {
      key: 'community',
      target: '[data-onboarding="nav-community"]',
      render: () => (
        <>
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-full bg-primary/12 flex items-center justify-center shrink-0">
              <MessageCircle className="w-[18px] h-[18px] text-primary" />
            </span>
            <h2 className="font-display text-[22px] leading-tight text-foreground">
              아는 사람들과 더 가깝게
            </h2>
          </div>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            학교·모임 사람들끼리 <b className="text-foreground">커뮤니티 책장</b>을 함께 써요. 아는 이웃끼리라 더 안심돼요.
          </p>
          <p className="text-[13px] text-faint leading-relaxed w-full text-left">
            하단 <b className="text-foreground">커뮤니티</b> 탭에서
          </p>
          <ol className="w-full space-y-2 text-left">
            <StepRow n={1} title="받은 초대 링크로 참여하거나" />
            <StepRow n={2} title="비밀번호로 가입하거나" />
            <StepRow n={3} title="직접 만들어서 친구를 초대하세요" accent />
          </ol>
        </>
      ),
    },

    // ⑥ 마무리 — 등록을 강요하지 않는다. 처음 온 사람에게 필요한 건 숙제가 아니라 구경거리다.
    {
      key: 'done',
      render: () => (
        <>
          <div className="w-14 h-14 rounded-full bg-primary/12 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <h2 className="font-display text-[30px] leading-tight text-foreground">
            이제 이웃의 책장이
            <br />
            열렸어요
          </h2>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            마음에 드는 책이 있으면 언제든 대여를 신청해보세요.
          </p>
        </>
      ),
    },
  ];

  const isLast = step === steps.length - 1;
  const current = steps[step];
  const rect = useSpotlight(current.target, step);
  const [cardRef, cardH] = useMeasuredHeight(step);
  // 알림 스텝의 메인 화면만 코랄 카드로 강조 (설치/텔레그램 하위화면은 흰 카드)
  const coralCard = current.key === 'push' && pushView === 'main';

  const handleNext = () => {
    if (!isLast) {
      const next = step + 1;
      track('onboarding_step', { step: steps[next].key });
      setStep(next);
      return;
    }
    track('onboarding_completed');
    onComplete();
  };

  /**
   * 말풍선은 대상 옆에 "깔끔하게 들어갈 때만" 붙인다.
   * 서가처럼 화면보다 큰 대상은 위아래 어디에도 자리가 없다 —
   * 그럴 땐 억지로 구석에 밀어넣지 말고 화면 중앙에 띄운다. 읽기 편한 쪽이 옳다.
   */
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const GAP = HALO + 14;
  const spaceBelow = rect ? vh - (rect.top + rect.height) - GAP : 0;
  const spaceAbove = rect ? rect.top - GAP : 0;
  const fitsBelow = !!rect && cardH > 0 && spaceBelow >= cardH + 12;
  const fitsAbove = !!rect && cardH > 0 && spaceAbove >= cardH + 12;
  /** 대상 옆에 붙일지 여부. 아니면 중앙 모달로 뜬다. */
  const anchored = fitsBelow || fitsAbove;
  const placeBelow = fitsBelow;
  const cardTop = rect
    ? clamp(
        placeBelow ? rect.top + rect.height + GAP : rect.top - GAP - cardH,
        12,
        Math.max(12, vh - cardH - 12)
      )
    : 0;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* 클릭 차단막 — 온보딩 중에는 앱을 조작할 수 없다 */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* 스포트라이트: 구멍 자체는 투명하고, 바깥을 거대한 box-shadow로 덮는다.
          → 조준한 요소는 실제 앱 화면 그대로 보이고, 나머지만 어두워진다. */}
      <AnimatePresence>
        {rect && (
          <motion.div
            key="hole"
            className="absolute rounded-2xl pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              top: rect.top - HALO,
              left: rect.left - HALO,
              width: rect.width + HALO * 2,
              height: rect.height + HALO * 2,
            }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            style={{
              boxShadow: '0 0 0 9999px hsl(var(--foreground) / 0.62)',
              outline: '2px solid hsl(var(--primary))',
              outlineOffset: -1,
            }}
          />
        )}
      </AnimatePresence>

      {/* 조준할 대상이 없는 단계(첫 화면)는 화면 전체를 덮는다 */}
      {!rect && (
        <div
          className="absolute inset-0 backdrop-blur-[2px]"
          style={{ background: 'hsl(var(--foreground) / 0.62)' }}
        />
      )}

      {/* 말풍선 — 대상 옆에 자리가 있으면 붙이고, 없으면 화면 가운데에.
          (framer-motion이 transform을 쓰므로 가운데 정렬은 flex 래퍼로 한다) */}
      <div
        className={
          anchored
            ? 'contents'
            : 'absolute inset-0 flex items-center justify-center px-4 pointer-events-none'
        }
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={current.key}
            ref={cardRef}
            initial={{ opacity: 0, y: placeBelow ? -8 : 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`${anchored ? 'absolute' : 'relative pointer-events-auto'} w-[min(340px,calc(100vw-32px))] max-h-[calc(100vh-24px)] overflow-y-auto ${coralCard ? 'bg-primary' : 'bg-card'} rounded-2xl shadow-hip-lg p-5`}
            style={
              anchored && rect
                ? {
                    left: clamp(
                      rect.left + rect.width / 2 - 170,
                      16,
                      Math.max(16, window.innerWidth - 356)
                    ),
                    top: cardTop,
                  }
                : undefined
            }
          >
            <div
              className={`flex flex-col gap-3 ${anchored ? 'items-start text-left' : 'items-center text-center'}`}
            >
              {current.render()}
            </div>

            {/* 진행 표시 + 액션 */}
            <div className="flex items-center justify-between gap-3 mt-5">
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step
                        ? coralCard ? 'w-5 bg-primary-foreground' : 'w-5 bg-primary'
                        : coralCard ? 'w-1.5 bg-primary-foreground/30' : 'w-1.5 bg-muted-foreground/25'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // 알림 스텝에서 '나중에'는 바로 종료하지 않고 "설정에서 다시 켤 수 있어요" 안내를 띄운다
                    if (current.key === 'push' && !isLast) {
                      track('onboarding_skipped', { step: 'push' });
                      setShowLater(true);
                      return;
                    }
                    if (!isLast) track('onboarding_skipped', { step: current.key });
                    else track('onboarding_completed');
                    onComplete();
                  }}
                  className={`text-xs transition-colors px-2 py-2 ${
                    coralCard ? 'text-primary-foreground/85 hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {current.key === 'push' && !isLast ? '나중에' : isLast ? '닫기' : '건너뛰기'}
                </button>
                <Button
                  onClick={handleNext}
                  className={`h-10 px-4 rounded-full text-sm font-semibold gap-1.5 ${
                    coralCard ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90' : ''
                  }`}
                >
                  {isLast ? '책장 둘러보기' : '다음'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* '나중에' 클릭 시 안내 팝업 — 지금 안 켜도 나중에 켤 수 있음을 알려주고 온보딩 종료 */}
      <AnimatePresence>
        {showLater && (
          <motion.div
            className="absolute inset-0 z-[110] flex items-center justify-center px-8"
            style={{ background: 'hsl(var(--foreground) / 0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-[300px] bg-card rounded-2xl p-5 text-center shadow-hip-lg pointer-events-auto"
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0 }}
            >
              <div className="w-11 h-11 rounded-xl bg-primary/12 flex items-center justify-center mx-auto mb-3">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display text-[17px] text-foreground mb-1.5">언제든 다시 켤 수 있어요</h3>
              <p className="text-[15px] text-muted-foreground mb-4 leading-relaxed">
                프로필 › 알림 설정에서 켜면 돼요
              </p>
              <Button
                onClick={() => { setShowLater(false); onComplete(); }}
                className="w-full h-11 rounded-full text-sm font-semibold"
              >
                알겠어요
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** 말풍선 높이를 알아야 화면 밖으로 나가지 않게 배치할 수 있다 */
function useMeasuredHeight(step: number): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const measure = () => setHeight(ref.current?.offsetHeight ?? 0);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [step]);

  return [ref, height];
}

/**
 * 조준 대상의 화면상 위치를 추적한다.
 * 탭 전환·레이아웃 변화로 위치가 흔들릴 수 있어 리사이즈·스크롤에도 다시 잰다.
 */
function useSpotlight(selector: string | undefined, step: number): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  const measure = useCallback(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(selector);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setRect(null);
      return;
    }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [selector]);

  useLayoutEffect(() => {
    // 대상이 화면 밖에 있으면 보이게 스크롤한 뒤 잰다
    if (selector) {
      document.querySelector(selector)?.scrollIntoView({ block: 'nearest' });
    }
    measure();
    const id = requestAnimationFrame(measure); // 애니메이션 정착 후 한 번 더
    return () => cancelAnimationFrame(id);
  }, [measure, selector, step]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  return rect;
}

/* ── 보조 컴포넌트 ─────────────────────────────────────── */

/** 범례용 미니 책등 — 실제 서가와 같은 언어로 그린다 */
const Spine = ({
  color,
  ribbon,
  ghost,
}: {
  color: string;
  ribbon?: 'lent' | 'borrowed';
  ghost?: boolean;
}) => (
  <div
    className={`relative w-[15px] h-[36px] rounded-t-[2px] ${color} ${ghost ? 'opacity-50' : ''}`}
    style={{
      boxShadow: 'inset -3px 0 5px rgba(0,0,0,.2), inset 2px 0 2px rgba(255,255,255,.16)',
      outline: ghost ? '1px dashed #A89E88' : undefined,
      outlineOffset: ghost ? -2 : undefined,
    }}
  >
    {ribbon && (
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[10px] h-[13px]"
        style={{
          background:
            ribbon === 'lent'
              ? 'linear-gradient(180deg,#D4A827,#7A4E08)'
              : 'linear-gradient(180deg,#7478B8,#313468)',
          clipPath: 'polygon(0 0,100% 0,100% 72%,50% 100%,0 72%)',
        }}
      />
    )}
  </div>
);

const LegendRow = ({ swatch, title }: { swatch: ReactNode; title: string }) => (
  <div className="flex items-center gap-3">
    <div className="w-7 flex justify-center shrink-0">{swatch}</div>
    <p className="text-[15px] font-bold text-foreground leading-tight text-left">{title}</p>
  </div>
);

const StepRow = ({ n, title, accent }: { n: number; title: string; accent?: boolean }) => (
  <li className="flex items-center gap-3">
    <span
      className={`w-6 h-6 shrink-0 rounded-full text-[13px] font-black flex items-center justify-center ${
        accent ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
      }`}
    >
      {n}
    </span>
    <span className={`text-[15px] text-foreground ${accent ? 'font-bold' : ''}`}>{title}</span>
  </li>
);

const BenefitRow = ({ text }: { text: string }) => (
  <li className="flex items-start gap-2">
    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
    <span>{text}</span>
  </li>
);

/** 코랄 카드용 혜택 행 (흰 아이콘 칩 + 흰 글자) */
const CoralBenefit = ({ icon, text }: { icon: ReactNode; text: string }) => (
  <li className="flex items-center gap-2.5 text-[15px] text-primary-foreground">
    <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0 text-primary-foreground">
      {icon}
    </span>
    {text}
  </li>
);

/** 번호 칩 — 기본은 크림, 핵심 단계만 코랄 */
const StepNum = ({ n, hot }: { n: number; hot?: boolean }) => (
  <span
    className={`w-6 h-6 shrink-0 rounded-full text-[13px] font-black flex items-center justify-center ${
      hot ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
    }`}
  >
    {n}
  </span>
);

/** 설치 안내 단계 — 문장은 볼드 섞지 않고 기본체, 영문은 흐리게 병기 */
const InstallStep = ({ n, ko, en, hot }: { n: number; ko: string; en?: string; hot?: boolean }) => (
  <li className="flex items-start gap-3">
    <StepNum n={n} hot={hot} />
    <p className="text-[15px] text-foreground leading-relaxed">
      {ko}
      {en && <span className="text-muted-foreground"> ({en})</span>}
    </p>
  </li>
);

/**
 * 빌리는 흐름 미리보기 — "책등을 탭하면 무엇이 열리는가"를 말로 설명하는 대신 그려서 보여준다.
 * 실제 상세 시트와 같은 구성(표지 · 제목 · 코랄 대여 신청 버튼)이다.
 */
const BorrowDemo = () => (
  <div className="w-full flex items-center gap-2.5 rounded-xl bg-muted p-3">
    {/* 탭하는 책등 */}
    <div className="flex items-end gap-[3px] h-[62px] shrink-0">
      <div className="w-[9px] h-[76%] rounded-t-[2px] bg-book-1 opacity-40" />
      <div
        className="relative w-[13px] h-full rounded-t-[2px] bg-book-2"
        style={{ boxShadow: 'inset -3px 0 5px rgba(0,0,0,.2), 0 0 0 2px hsl(var(--primary))' }}
      />
      <div className="w-[9px] h-[68%] rounded-t-[2px] bg-book-5 opacity-40" />
    </div>

    <ChevronRight className="w-4 h-4 text-faint shrink-0" />

    {/* 열리는 상세 시트 */}
    <div className="flex-1 min-w-0 rounded-lg bg-card border border-border p-2">
      <div className="flex items-center gap-2">
        <div className="w-[22px] h-[30px] rounded-[2px] bg-book-2 shrink-0" />
        <div className="min-w-0">
          <p className="font-display text-[15px] text-foreground leading-none truncate">데미안</p>
          <p className="text-[11px] text-faint mt-0.5 truncate">헤르만 헤세 · 대여 가능</p>
        </div>
      </div>
      <div className="mt-2 h-[22px] rounded-[3px] bg-primary flex items-center justify-center">
        <span className="text-[13px] font-bold text-primary-foreground">대여 신청</span>
      </div>
    </div>
  </div>
);

/**
 * 책갈피 데모 — 범례만 글로 읽으면 남지 않는다.
 * 실제 서가와 똑같이 생긴 책등에 책갈피를 꽂아, 눈으로 한 번 보게 만든다.
 */
const BookmarkDemo = () => (
  <div className="w-full rounded-xl bg-muted px-3 pt-7 pb-0">
    <div className="flex items-end gap-1.5 h-[96px]">
      <DemoSpine color="bg-book-2" h="84%" title="1984" />
      <DemoSpine color="bg-book-4" h="100%" title="데미안" ribbon="lent" dday="D-2" who="민지" />
      <DemoSpine color="bg-book-6" h="90%" title="코스모스" ribbon="borrowed" dday="D-5" who="다은" />
      <DemoSpine color="bg-book-3" h="78%" title="사피엔스" ghost />
    </div>
    <div className="h-[2px] bg-foreground" />
    <div className="h-[7px]" style={{ background: 'linear-gradient(#DDD6C4, #EFE9DB)' }} />
  </div>
);

const DemoSpine = ({
  color,
  h,
  title,
  ribbon,
  dday,
  who,
  ghost,
}: {
  color: string;
  h: string;
  title: string;
  ribbon?: 'lent' | 'borrowed';
  dday?: string;
  who?: string;
  /** 남이 빌려가서 지금 빌릴 수 없는 책 */
  ghost?: boolean;
}) => {
  // 내가 빌려준 책도 자리에 없는 건 마찬가지다 — 실제 서가와 똑같이 희미해진다.
  // 다만 책갈피와 이름칩은 위에 남는다: 누가 가져갔는지는 또렷해야 하니까.
  const lentAway = ribbon === 'lent';

  return (
    <div
      className={`relative flex-1 rounded-t-[2px] flex items-center justify-center ${color}`}
      style={{
        height: h,
        boxShadow: 'inset -3px 0 5px rgba(0,0,0,.2), inset 2px 0 2px rgba(255,255,255,.16)',
        opacity: ghost ? 0.45 : 1,
        outline: ghost || lentAway ? '1px dashed #A89E88' : undefined,
        outlineOffset: ghost || lentAway ? -2 : undefined,
      }}
    >
      {lentAway && (
        <div
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{ background: 'rgba(244, 241, 234, 0.6)' }}
        />
      )}

      <span
        className="font-display text-[11px] text-spine-text mt-3 whitespace-nowrap relative z-[3]"
        style={{ writingMode: 'vertical-rl', opacity: lentAway ? 0.5 : 1 }}
      >
        {title}
      </span>

      {ribbon && (
        <>
        {/* 책갈피 리본 — 위에서 아래로 꽂힌 모양 */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[64%] h-[26px] flex items-start justify-center pt-[3px] z-[5]"
          style={{
            background:
              ribbon === 'lent'
                ? 'linear-gradient(180deg,#D4A827 0%,#A87010 55%,#7A4E08 100%)'
                : 'linear-gradient(180deg,#7478B8 0%,#484B8C 55%,#313468 100%)',
            clipPath: 'polygon(0 0,100% 0,100% 72%,50% 100%,0 72%)',
            boxShadow: '0 4px 9px rgba(0,0,0,.3)',
          }}
        >
          <span
            className="text-[9px] font-black"
            style={{ color: ribbon === 'lent' ? 'rgba(255,235,180,.92)' : 'rgba(205,214,255,.9)' }}
          >
            {dday}
          </span>
        </div>
        {/* 누구와의 거래인지 — 화살표 방향이 곧 대여 방향이다 */}
        <div
          className="absolute -top-[13px] left-1/2 -translate-x-1/2 flex items-center gap-[2px] px-1.5 py-[2px] rounded-full whitespace-nowrap z-[6]"
          style={{
            background:
              ribbon === 'lent'
                ? 'linear-gradient(135deg,#C68510,#8F5A05)'
                : 'linear-gradient(135deg,#5658A0,#383A7E)',
            boxShadow: '0 3px 7px rgba(0,0,0,.28)',
          }}
        >
          <span className="text-[9px] font-black text-white opacity-75">
            {ribbon === 'lent' ? '↑' : '↓'}
          </span>
          <span className="text-[9px] font-black text-white">{who}</span>
        </div>
        </>
      )}
    </div>
  );
};

/** 온보딩 첫 화면의 미니 서가 — 가변 높이 + 크림 선반, 실제 서가와 같은 조형 */
const ShelfArt = () => (
  <div className="w-full max-w-[240px]">
    <div className="flex items-end gap-1.5 h-[92px]">
      {([
        ['bg-book-1', 74],
        ['bg-book-4', 92],
        ['bg-book-2', 80],
        ['bg-book-6', 100],
        ['bg-book-3', 68],
        ['bg-book-5', 88],
      ] as const).map(([c, h], i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          animate={{ height: `${h}%` }}
          transition={{ delay: i * 0.06, type: 'spring', stiffness: 200, damping: 20 }}
          className={`flex-1 rounded-t-[2px] ${c}`}
          style={{ boxShadow: 'inset -3px 0 5px rgba(0,0,0,.2), inset 2px 0 2px rgba(255,255,255,.16)' }}
        />
      ))}
    </div>
    <div className="h-[2px] bg-foreground" />
    <div className="h-[7px]" style={{ background: 'linear-gradient(#DDD6C4, #EFE9DB)' }} />
  </div>
);
