import { Suspense, useEffect, useRef } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@/hooks/useAuth";
import { GuestGateProvider } from "@/hooks/useGuestGate";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthPromptModal } from "@/components/auth/AuthPromptModal";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { lazyRetry } from "@/lib/lazyRetry";
import { initDeepLinks } from "@/lib/deepLink";
import { initNativePushTaps } from "@/lib/nativePush";
import { toast } from "sonner";
import { AuthPage } from "@/pages/AuthPage";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { useOverlayScrollLock } from '@/hooks/useOverlayScrollLock';

// 일반 유저는 평생 열지 않는 화면들 — 첫 로딩에 함께 내려보내지 않는다.
// 특히 AdminPortal은 관리자 전용 컴포넌트 8개를 끌고 온다.
// lazyRetry: 새 배포로 옛 청크가 사라졌을 때 하얀 화면 대신 1회 자동 새로고침.
const ResetPasswordPage = lazyRetry(() => import("./pages/ResetPasswordPage"));
const AdminPortal = lazyRetry(() => import("./pages/AdminPortal"));
const TermsPage = lazyRetry(() => import("./pages/TermsPage"));
const PrivacyPage = lazyRetry(() => import("./pages/PrivacyPage"));
// 임시: 미채택 기능("나의 도서관") 미리보기. 채택 여부 결정 후 제거.
// 가상 도서관 (Phaser). 무거운 게임 엔진이라 lazy 로드.
const VirtualSpacePage = lazyRetry(() => import("./pages/VirtualSpacePage"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

// 라우트가 바뀌면 에러바운더리를 리셋(뒤로가기로 에러 화면에서 빠져나올 수 있게)
const AppRoutes = () => {
  // 팝업이 떠 있는 동안 뒤 화면이 밀리지 않게 문서를 묶는다
  useOverlayScrollLock();

  const location = useLocation();
  const navigate = useNavigate();

  // 앱이 인증 링크로 열렸을 때 세션을 만들고 그 화면으로 보낸다(네이티브 전용).
  // 웹에서는 브라우저가 알아서 하므로 아무 일도 하지 않는다.
  /**
   * 딥링크 리스너는 **앱이 사는 동안 딱 한 번만** 등록한다.
   *
   * ⚠️ 예전엔 의존성이 `[navigate]`였다. `BrowserRouter`에서 `useNavigate()`는
   *    이동할 때마다 새 함수를 준다 → 화면을 옮길 때마다 effect가 다시 돌고,
   *    등록이 비동기라 정리 함수가 아직 없는 상태에서 정리가 먼저 실행됐다.
   *    리스너가 떨어졌다 붙었다 하는 경합이 생긴다.
   *    그래서 navigate는 ref에 담고 effect는 빈 의존성으로 둔다.
   */
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void initDeepLinks((path) => navigateRef.current(path, { replace: true })).then((fn) => {
      // 등록이 끝나기 전에 언마운트됐으면 바로 정리한다(안 하면 리스너가 남는다)
      if (disposed) fn();
      else cleanup = fn;
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  // 알림 배선 — 눌러서 들어오면 그 화면으로, 앱을 보고 있을 때 오면 앱 안에서 알린다.
  // (iOS 는 앱이 떠 있을 때 온 알림을 배너로 띄우지 않고 그냥 삼킨다)
  useEffect(() => {
    void initNativePushTaps(
      (path) => navigateRef.current(path, { replace: true }),
      ({ title, body, url }) => {
        toast(title, {
          description: body || undefined,
          action: { label: '보기', onClick: () => navigateRef.current(url, { replace: true }) },
        });
      },
    );
  }, []);

  return (
    <RouteErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<AuthPage />} />
          {/* 재설정 링크는 세션을 만들어준다. AuthPage에 두면 로그인된 것으로 보고
              비밀번호를 바꾸기도 전에 홈으로 튕겨낸다. 그래서 별도 라우트다. */}
          <Route path="/auth/reset" element={<ResetPasswordPage />} />
          <Route path="/admin-portal" element={<AdminPortal />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/space" element={<VirtualSpacePage />} />
          <Route path="/space/community/:communityId" element={<VirtualSpacePage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
};

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          {/* 인앱 알림은 Sonner 하나로 통일 — top-center, 3초 자동 사라짐 */}
          <Sonner />
          <BrowserRouter>
            {/* 게스트도 앱을 둘러볼 수 있다. 가입 유도는 GuestGate가 맡는다. */}
            <GuestGateProvider>
              <AppRoutes />
              <AuthPromptModal />
            </GuestGateProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
