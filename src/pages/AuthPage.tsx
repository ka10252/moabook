import React, { useState, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Loader2, Globe, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { z } from 'zod';
import { Separator } from '@/components/ui/separator';
import { CountrySelector } from '@/components/auth/CountrySelector';
import { ALLOWED_COUNTRY } from '@/data/countries';
import { Link } from 'react-router-dom';

const signUpSchema = z.object({
  email: z.string().trim().email({ message: "올바른 이메일 주소를 입력해주세요" }).max(255),
  password: z.string().min(6, { message: "비밀번호는 6자 이상이어야 합니다" }).max(100),
  nickname: z.string().trim().min(2, { message: "닉네임은 2자 이상이어야 합니다" }).max(30),
});

const signInSchema = z.object({
  email: z.string().trim().email({ message: "올바른 이메일 주소를 입력해주세요" }).max(255),
  password: z.string().min(1, { message: "비밀번호를 입력해주세요" }).max(100),
});


export const AuthPage = forwardRef<HTMLDivElement>((_, ref) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [country, setCountry] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [showRegionBlock, setShowRegionBlock] = useState(false);
  const { signUp, signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
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

        const { error } = await signUp(email, password, nickname, country);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Moa에 오신 것을 환영합니다! 📚');
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
          toast.error(error.message);
        } else {
          toast.success('다시 오신 것을 환영합니다! 📖');
          resetForm();
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsDemoLoading(true);
    try {
      const { error } = await signIn('demo@moabook.app', 'demo1234!');
      if (error) throw error;
      toast.success('체험 계정으로 로그인했습니다 📚');
    } catch (err) {
      console.error('Demo login error:', err);
      toast.error('체험 로그인에 실패했습니다');
    } finally {
      setIsDemoLoading(false);
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
            alt="Moa - 모두의 아카이브"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="h-24 mx-auto mb-2"
          />
          <p className="font-display italic text-muted-foreground text-lg">
            커뮤니티와 함께 독서하세요
          </p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-3xl p-8 shadow-xl border border-border">
          {/* Header */}
          <div className="text-center mb-6">
            <p className="eyebrow">{mode === 'signin' ? 'Welcome back' : 'Get started'}</p>
            <h2 className="font-display text-[28px] font-medium tracking-tight text-foreground mt-1.5 mb-2">
              {mode === 'signin' ? '다시 오신 것을 환영합니다' : '계정 만들기'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === 'signin'
                ? '로그인하여 책장에 접속하세요'
                : '프로필을 설정하고 책 나눔을 시작하세요'}
            </p>
          </div>

          {/* Demo Login Button */}
          <Button
            type="button"
            variant="secondary"
            className="w-full h-12 rounded-xl text-base font-medium gap-3"
            onClick={handleDemoLogin}
            disabled={isDemoLoading}
          >
            {isDemoLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <User className="w-5 h-5" />
                🎭 체험 로그인 (계정 불필요)
              </>
            )}
          </Button>

          <div className="relative my-6">
            <Separator />
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
              또는
            </span>
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

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-12 h-12 rounded-xl bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
                maxLength={100}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mode === 'signin' ? (
                '로그인'
              ) : (
                '회원가입'
              )}
            </Button>
          </form>

          {/* Toggle mode */}
          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              {mode === 'signin' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
              <button
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="ml-2 text-primary font-semibold hover:underline"
              >
                {mode === 'signin' ? '회원가입' : '로그인'}
              </button>
            </p>
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
