import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Loader2, KeyRound, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { PasswordRequirements } from '@/components/auth/PasswordRequirements';
import { passwordSchema } from '@/lib/passwordSchema';
import { toast } from 'sonner';
import { useNavigate, Link } from 'react-router-dom';

/**
 * 비밀번호 재설정 — 메일의 링크를 눌러 들어오는 화면.
 *
 * 이 페이지는 AuthPage와 분리돼 있어야 한다. 재설정 링크는 세션을 만들어주는데,
 * AuthPage는 "로그인된 유저"를 홈으로 돌려보낸다. 같은 페이지에 두면
 * 비밀번호를 바꾸기도 전에 홈으로 쫓겨난다.
 */
export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  /** 링크가 유효한가 — null이면 아직 확인 중 */
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    // 재설정 링크의 토큰은 supabase-js가 URL에서 자동으로 읽어 세션으로 바꾼다.
    // 그게 끝나기 전에 판단하면 멀쩡한 링크를 만료됐다고 오해한다.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setHasSession(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      setHasSession((prev) => prev ?? !!data.session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = passwordSchema.safeParse(password);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    if (password !== confirm) {
      toast.error('비밀번호가 서로 달라요');
      return;
    }

    setIsLoading(true);
    const { error } = await updatePassword(password);
    setIsLoading(false);

    if (error) {
      toast.error(
        error.message.toLowerCase().includes('same')
          ? '기존과 다른 비밀번호로 정해주세요'
          : '비밀번호를 바꾸지 못했어요. 링크가 만료됐을 수 있어요.'
      );
      return;
    }

    toast.success('비밀번호를 바꿨어요');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <img src="/moa-logo.png" alt="MOA Book" className="h-20 mx-auto" />
        </div>

        <div className="bg-card rounded-3xl p-8 shadow-xl border border-border">
          {hasSession === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : hasSession === false ? (
            /* 링크가 만료됐거나 이미 쓴 경우 — 여기서 막다른 길로 두면 유저는 못 돌아온다 */
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-destructive" />
              </div>
              <h2 className="font-display text-[30px] font-medium tracking-tight text-foreground mb-2">
                링크가 만료됐어요
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                비밀번호 재설정 링크는 한 번만, 그리고 잠깐만 쓸 수 있어요.
                <br />
                새 링크를 다시 받아주세요.
              </p>
              <Button asChild className="w-full h-12 rounded-xl">
                <Link to="/auth?mode=forgot">재설정 메일 다시 받기</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="w-7 h-7 text-primary" />
                </div>
                <p className="eyebrow">New password</p>
                <h2 className="font-display text-[30px] font-medium tracking-tight text-foreground mt-1.5">
                  새 비밀번호를 정해주세요
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="새 비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 h-12 rounded-xl bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
                    autoComplete="new-password"
                  />
                </div>

                <PasswordRequirements value={password} />

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="새 비밀번호 확인"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-12 h-12 rounded-xl bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary"
                    autoComplete="new-password"
                  />
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '비밀번호 바꾸기'}
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;
