import React, { useState, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Loader2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { z } from 'zod';
import { Separator } from '@/components/ui/separator';

const signUpSchema = z.object({
  email: z.string().trim().email({ message: "올바른 이메일 주소를 입력해주세요" }).max(255),
  password: z.string().min(6, { message: "비밀번호는 6자 이상이어야 합니다" }).max(100),
  nickname: z.string().trim().min(2, { message: "닉네임은 2자 이상이어야 합니다" }).max(30),
});

const signInSchema = z.object({
  email: z.string().trim().email({ message: "올바른 이메일 주소를 입력해주세요" }).max(255),
  password: z.string().min(1, { message: "비밀번호를 입력해주세요" }).max(100),
});

// Mock nicknames for demo
const MOCK_NICKNAMES = ['책벌레', '독서광', '책덕후', '페이지터너', '소설팬'];

export const AuthPage = forwardRef<HTMLDivElement>((_, ref) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const { signUp, signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        const validation = signUpSchema.safeParse({ email, password, nickname });
        if (!validation.success) {
          toast.error(validation.error.errors[0].message);
          setIsLoading(false);
          return;
        }

        const { error } = await signUp(email, password, nickname);
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

  // Mock login for prototype - creates a demo account
  const handleDemoLogin = async () => {
    setIsDemoLoading(true);
    try {
      // Generate a unique mock email and random nickname
      const timestamp = Date.now();
      const mockEmail = `demo_${timestamp}@moa-demo.com`;
      const mockPassword = `demo_password_${timestamp}`;
      const mockNickname = MOCK_NICKNAMES[Math.floor(Math.random() * MOCK_NICKNAMES.length)] + '_' + timestamp.toString().slice(-4);

      // First try to sign up
      const { error: signUpError } = await signUp(mockEmail, mockPassword, mockNickname);
      
      if (signUpError) {
        // If signup fails (maybe account exists), try signing in with existing demo
        const { error: signInError } = await signIn('demo@moa-demo.com', 'demo_password_123');
        if (signInError) {
          // Create a fresh demo account
          const { error } = await signUp('demo@moa-demo.com', 'demo_password_123', '체험용계정');
          if (error && !error.message.includes('already registered')) {
            throw error;
          }
          // Try signing in again
          await signIn('demo@moa-demo.com', 'demo_password_123');
        }
      }
      
      toast.success(`환영합니다, ${mockNickname}님! 📚`);
    } catch (err) {
      console.error('Demo login error:', err);
      toast.error('체험 계정 생성에 실패했습니다');
    } finally {
      setIsDemoLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setNickname('');
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
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4"
          >
            <BookOpen className="w-10 h-10 text-primary" />
          </motion.div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Moa 📚</h1>
          <p className="text-muted-foreground">
            커뮤니티와 함께 책을 나누세요
          </p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-3xl p-8 shadow-xl border border-border">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-1">
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
        </div>
      </motion.div>
    </div>
  );
});

AuthPage.displayName = 'AuthPage';
