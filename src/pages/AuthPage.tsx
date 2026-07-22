import React, { useState, useEffect, forwardRef } from 'react';
import { track } from '@/lib/analytics';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, MailCheck, Lock, User, Loader2, Globe, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { z } from 'zod';
import { Separator } from '@/components/ui/separator';
import { CountrySelector } from '@/components/auth/CountrySelector';
import { PasswordRequirements } from '@/components/auth/PasswordRequirements';
import { passwordSchema } from '@/lib/passwordSchema';
import { ALLOWED_COUNTRY } from '@/data/countries';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

const signUpSchema = z.object({
  email: z.string().trim().email({ message: "올바른 이메일 주소를 입력해주세요" }).max(255),
  password: passwordSchema,
  nickname: z.string().trim().min(2, { message: "닉네임은 2자 이상이어야 합니다" }).max(30),
});

const signInSchema = z.object({
  email: z.string().trim().email({ message: "올바른 이메일 주소를 입력해주세요" }).max(255),
  password: z.string().min(1, { message: "비밀번호를 입력해주세요" }).max(100),
});

const emailSchema = z.string().trim().email({ message: "올바른 이메일 주소를 입력해주세요" }).max(255);

type AuthMode = 'signin' | 'signup' | 'forgot';

/**
 * Supabase가 주는 에러는 영어 원문이다. 그대로 띄우면 유저는 뭘 해야 할지 모른다.
 * 무엇이 잘못됐는지가 아니라 "다음에 뭘 하면 되는지"가 담겨야 한다.
 */
const authErrorMessage = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes('email not confirmed')) return '이메일 인증이 아직 안 됐어요. 메일함을 확인해주세요.';
  if (m.includes('invalid login credentials')) return '이메일 또는 비밀번호가 맞지 않아요.';
  if (m.includes('user already registered')) return '이미 가입된 이메일이에요. 로그인해주세요.';
  if (m.includes('email rate limit') || m.includes('too many requests'))
    return '메일을 너무 자주 보냈어요. 잠시 후 다시 시도해주세요.';
  return message;
};


export const AuthPage = forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 가입 유도 팝업에서 넘어올 때 어느 탭으로 열지 지정한다 (/auth?mode=signup)
  const initialMode = searchParams.get('mode');
  const [mode, setMode] = useState<AuthMode>(
    initialMode === 'signup' ? 'signup' : initialMode === 'forgot' ? 'forgot' : 'signin'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [country, setCountry] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRegionBlock, setShowRegionBlock] = useState(false);
  /**
   * 메일을 보낸 뒤의 상태. 여기서 유저가 할 수 있는 건 "메일 확인"과 "재발송"뿐이다.
   * 가입 인증 메일과 비밀번호 재설정 메일은 안내 문구와 재발송 방법이 달라 종류를 구분한다.
   */
  const [pending, setPending] = useState<{ email: string; kind: 'signup' | 'reset' } | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { user, signUp, signIn, resendConfirmation, requestPasswordReset } = useAuth();

  // 재발송 버튼을 연타하면 Supabase 발송 한도에 걸려 오히려 메일이 안 온다
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!pending || resendCooldown > 0) return;
    setIsLoading(true);
    const { error } =
      pending.kind === 'signup'
        ? await resendConfirmation(pending.email)
        : await requestPasswordReset(pending.email);
    setIsLoading(false);
    if (error) {
      toast.error(authErrorMessage(error.message));
      return;
    }
    setResendCooldown(60);
    toast.success('메일을 다시 보냈어요');
  };

  // 로그인/가입이 끝나면 둘러보던 홈으로 돌려보낸다
  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'forgot') {
        const validation = emailSchema.safeParse(email);
        if (!validation.success) {
          toast.error(validation.error.errors[0].message);
          setIsLoading(false);
          return;
        }

        const { error } = await requestPasswordReset(email);
        if (error) {
          toast.error(authErrorMessage(error.message));
          setIsLoading(false);
          return;
        }

        // 가입 안 된 이메일이어도 똑같이 "보냈다"고 말한다.
        // "그런 계정 없어요"라고 답하면 공격자가 이메일을 넣어보며 가입자 명단을 만들 수 있다.
        setPending({ email: email.trim(), kind: 'reset' });
        setResendCooldown(60);
        resetForm();
        setIsLoading(false);
        return;
      }

      if (mode === 'signup') {
        if (!country) {
          toast.error('국가를 선택해주세요');
          setIsLoading(false);
          return;
        }
        if (country !== ALLOWED_COUNTRY) {
          setShowRegionBlock(true);
          setIsLoading(false);
          return;
        }
        const validation = signUpSchema.safeParse({ email, password, nickname });
        if (!validation.success) {
          toast.error(validation.error.errors[0].message);
          setIsLoading(false);
          return;
        }

        const { error, needsEmailConfirmation } = await signUp(email, password, nickname, country);
        if (error) {
          toast.error(authErrorMessage(error.message));
        } else if (needsEmailConfirmation) {
          // 가입은 됐지만 아직 로그인이 아니다. "환영합니다"로 뭉개면
          // 유저는 다 됐다고 믿고 나갔다가 로그인이 안 되는 상태로 돌아온다.
          track('signup_completed', { pending_confirmation: true });
          setPending({ email: email.trim(), kind: 'signup' });
          resetForm();
        } else {
          track('signup_completed', { pending_confirmation: false });
          toast.success('MOA Book에 오신 것을 환영합니다! 📚');
          resetForm();
        }
      } else {
        const validation = signInSchema.safeParse({ email, password });
        if (!validation.success) {
          toast.error(validation.error.errors[0].message);
          setIsLoading(false);
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          // 미인증 계정이면 안내만 하고 끝내면 안 된다. 메일이 안 왔을 수도 있으니
          // 그 자리에서 재발송할 수 있는 화면으로 보낸다.
          if (error.message.toLowerCase().includes('email not confirmed')) {
            setPending({ email: email.trim(), kind: 'signup' });
          } else {
            toast.error(authErrorMessage(error.message));
          }
        } else {
          track('login_completed');
          toast.success('다시 오신 것을 환영합니다! 📖');
          resetForm();
        }
      }
    } finally {
      setIsLoading(false);
    }
  };


  const resetForm = () => {
    setEmail('');
    setPassword('');
    setNickname('');
    setCountry('');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.img
            src="/moa-logo.png"
            alt="MOA Book"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="h-24 mx-auto mb-2"
          />
          <p className="font-display italic text-muted-foreground text-lg">
            커뮤니티와 함께 독서하세요
          </p>
        </div>

        {/* 메일을 보낸 뒤 — 여기서 할 수 있는 건 메일 확인과 재발송뿐이므로 그 둘만 보여준다 */}
        {pending ? (
          <div className="bg-card rounded-3xl p-8 shadow-xl border border-border text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <MailCheck className="w-7 h-7 text-primary" />
            </div>
            <p className="eyebrow">Check your inbox</p>
            <h2 className="font-display text-[28px] font-medium tracking-tight text-foreground mt-1.5 mb-3">
              메일함을 확인해주세요
            </h2>
            <p className="text-sm text-muted-foreground">
              <b className="text-foreground break-all">{pending.email}</b> 으로{' '}
              {pending.kind === 'signup' ? '인증' : '비밀번호 재설정'} 메일을 보냈어요.
              <br />
              {pending.kind === 'signup'
                ? '메일의 링크를 눌러야 로그인할 수 있어요.'
                : '메일의 링크를 눌러 새 비밀번호를 정해주세요.'}
            </p>

            <p className="text-xs text-muted-foreground/80 mt-4">
              메일이 안 보이면 스팸함도 확인해주세요.
            </p>

            <div className="mt-6 space-y-2">
              <Button
                onClick={handleResend}
                disabled={isLoading || resendCooldown > 0}
                variant="outline"
                className="w-full h-12 rounded-xl"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : resendCooldown > 0 ? (
                  `다시 보내기 (${resendCooldown}초)`
                ) : (
                  '메일 다시 보내기'
                )}
              </Button>
              <Button
                variant="ghost"
                className="w-full h-12 rounded-xl text-muted-foreground"
                onClick={() => {
                  setPending(null);
                  setMode('signin');
                }}
              >
                로그인으로 돌아가기
              </Button>
            </div>
          </div>
        ) : (
        /* Card */
        <div className="bg-card rounded-3xl p-8 shadow-xl border border-border">
          {/* Header */}
          <div className="text-center mb-6">
            <p className="eyebrow">
              {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Get started' : 'Reset password'}
            </p>
            <h2 className="font-display text-[28px] font-medium tracking-tight text-foreground mt-1.5 mb-2">
              {mode === 'signin'
                ? '다시 오신 것을 환영합니다'
                : mode === 'signup'
                  ? '계정 만들기'
                  : '비밀번호를 잊으셨나요?'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === 'signin'
                ? '로그인하여 책장에 접속하세요'
                : mode === 'signup'
                  ? '프로필을 설정하고 책 나눔을 시작하세요'
                  : '가입한 이메일 주소를 알려주시면 재설정 링크를 보내드려요'}
            </p>
          </div>


          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="닉네임을 입력하세요"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="pl-12 h-12 rounded-xl bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
                    maxLength={30}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Globe className="w-4 h-4" />
                    <span>현재 거주 국가</span>
                  </div>
                  <CountrySelector value={country} onChange={setCountry} />
                </div>
              </>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="이메일 주소"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-12 h-12 rounded-xl bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
                maxLength={255}
              />
            </div>

            {/* 비밀번호 찾기 화면에서는 비밀번호를 물어볼 이유가 없다 — 잊어버려서 온 사람이다 */}
            {mode !== 'forgot' && (
              <div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 h-12 rounded-xl bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
                    maxLength={100}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                </div>
                {mode === 'signup' && <PasswordRequirements value={password} />}

                {/* 비밀번호를 잊은 사람은 여기서 막힌다. 출구를 바로 옆에 둔다. */}
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setPassword('');
                    }}
                    className="mt-2 ml-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                  >
                    비밀번호를 잊으셨나요?
                  </button>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mode === 'signin' ? (
                '로그인'
              ) : mode === 'signup' ? (
                '회원가입'
              ) : (
                '재설정 링크 받기'
              )}
            </Button>
          </form>

          {/* Toggle mode */}
          <div className="mt-6 text-center">
            {mode === 'forgot' ? (
              <button
                onClick={() => setMode('signin')}
                className="text-sm text-primary font-semibold hover:underline"
              >
                로그인으로 돌아가기
              </button>
            ) : (
              <p className="text-muted-foreground text-sm">
                {mode === 'signin' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
                <button
                  onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                  className="ml-2 text-primary font-semibold hover:underline"
                >
                  {mode === 'signin' ? '회원가입' : '로그인'}
                </button>
              </p>
            )}
          </div>

          {/* Legal links */}
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              서비스 이용 시{' '}
              <Link to="/terms" className="underline hover:text-foreground transition-colors">
                이용약관
              </Link>
              {' '}및{' '}
              <Link to="/privacy" className="underline hover:text-foreground transition-colors">
                개인정보 처리방침
              </Link>
              에 동의하게 됩니다.
            </p>
          </div>
        </div>
        )}

        {/* Region Block Popup */}
        <AnimatePresence>
          {showRegionBlock && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowRegionBlock(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="w-[calc(100%-2rem)] max-w-sm bg-card rounded-2xl p-6 shadow-2xl text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <h3 className="font-display text-xl font-medium text-foreground mb-2">서비스 이용 불가</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  죄송합니다. 아직 해당 지역에서는 서비스 이용이 준비되지 않았습니다.
                </p>
                <Button
                  onClick={() => setShowRegionBlock(false)}
                  className="w-full rounded-xl"
                >
                  확인
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
});

AuthPage.displayName = 'AuthPage';
