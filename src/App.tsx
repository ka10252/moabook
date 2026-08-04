import { Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@/hooks/useAuth";
import { GuestGateProvider } from "@/hooks/useGuestGate";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthPromptModal } from "@/components/auth/AuthPromptModal";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { lazyRetry } from "@/lib/lazyRetry";
import { AuthPage } from "@/pages/AuthPage";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

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
  const location = useLocation();
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
