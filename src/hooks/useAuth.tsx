import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    nickname: string,
    country?: string,
    region?: string
  ) => Promise<{ error: Error | null; needsEmailConfirmation: boolean }>;
  resendConfirmation: (email: string) => Promise<{ error: Error | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: Error | null; unavailable?: boolean }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, nickname: string, country?: string, region?: string) => {
    // Check if nickname is unique (case-insensitive)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('nickname', nickname.trim())
      .maybeSingle();

    if (existingProfile) {
      return { error: new Error('이미 존재하는 닉네임입니다.'), needsEmailConfirmation: false };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        // 국가는 가입 직후 profiles를 UPDATE 하는 방식으로는 저장할 수 없다.
        // 이메일 인증이 켜져 있으면 이 시점엔 세션이 없어서 auth.uid()가 null이고,
        // RLS가 그 UPDATE를 조용히 거부한다 → 지역 제한을 걸어두고 국가는 하나도 안 남는다.
        // 메타데이터로 넘겨서 handle_new_user 트리거가 프로필을 만들 때 함께 넣는다.
        data: {
          nickname,
          ...(country ? { country } : {}),
          ...(region ? { region } : {}),
        },
      },
    });

    if (error) return { error: error as Error, needsEmailConfirmation: false };

    // 인증 메일을 보내야 하는 설정이면 user는 생기지만 session은 없다.
    // 이걸 성공으로 뭉뚱그리면 "가입됐다"고 안내한 뒤 로그인이 안 되는 상태로 유저를 방치하게 된다.
    return { error: null, needsEmailConfirmation: !!data.user && !data.session };
  };

  /**
   * 비밀번호 재설정 메일 발송.
   *
   * 이 계정이 존재하는지 알려주지 않는다는 점이 중요하다. Supabase도 가입 안 된 이메일에
   * 성공을 반환한다. "그런 계정 없어요"라고 답하면 공격자가 이메일을 하나씩 넣어보며
   * 우리 서비스의 가입자 명단을 만들 수 있다.
   */
  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    return { error: error as Error | null };
  };

  /** 재설정 링크로 들어온 세션에서 새 비밀번호를 저장한다. */
  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error as Error | null };
  };

  /** 인증 메일 재발송 — 메일이 안 왔거나 링크가 만료된 사람에게 유일한 출구다. */
  const resendConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  /**
   * 탈퇴는 Edge Function(delete-account)이 auth.users까지 지워야 완결된다.
   * 함수가 미배포/장애면 유저가 탈퇴할 방법이 아예 없어진다 — PDPA상 삭제권 보장 실패.
   * 그래서 실패를 두 종류로 구분해 반환하고, UI가 대체 경로를 안내하게 한다.
   */
  const deleteAccount = async (): Promise<{ error: Error | null; unavailable?: boolean }> => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return { error: new Error('로그인이 필요합니다') };

    let response: Response;
    try {
      response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
    } catch {
      // 네트워크 오류 또는 함수 미배포
      return { error: new Error('탈퇴 처리 서버에 연결할 수 없습니다'), unavailable: true };
    }

    // 함수가 배포되지 않았으면 404/501이 오고 본문이 JSON이 아닐 수 있다.
    let data: { error?: string } = {};
    try {
      data = await response.json();
    } catch {
      if (!response.ok) {
        return { error: new Error('탈퇴 처리 서버에 연결할 수 없습니다'), unavailable: true };
      }
    }

    if (!response.ok || data.error) {
      const unavailable = response.status === 404 || response.status === 501 || response.status >= 502;
      return { error: new Error(data.error || '탈퇴 처리에 실패했습니다'), unavailable };
    }

    await supabase.auth.signOut();
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        resendConfirmation,
        requestPasswordReset,
        updatePassword,
        signIn,
        signInWithGoogle,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
