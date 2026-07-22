import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, FlaskConical } from 'lucide-react';
import { LibraryPage } from '@/components/library/LibraryPage';
import { useAuth } from '@/hooks/useAuth';
import { AuthPage } from '@/pages/AuthPage';
import { toast } from 'sonner';

/**
 * 임시 미리보기 화면.
 *
 * LibraryPage("나의 도서관")는 구현은 되어 있으나 앱 어디에서도 진입할 수 없는 상태였다.
 * 정식 채택 여부를 정하기 전에 눈으로 확인하려고 /library 경로만 임시로 열어둔다.
 * 정식 도입하면 이 파일은 지우고 BottomNav 탭으로 옮긴다.
 */
const LibraryPreview = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-accent/15 border-b border-accent/30 px-4 py-2 flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-accent shrink-0" />
        <p className="text-xs text-foreground/80">
          미리보기 — 이 화면은 아직 앱 메뉴에 연결되어 있지 않습니다.
        </p>
      </div>

      <header className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-xl hover:bg-muted transition-colors"
          aria-label="돌아가기"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <span className="text-sm text-muted-foreground">메인으로</span>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="h-full max-w-[520px] mx-auto w-full">
          <LibraryPage
            onOpenChat={() =>
              toast.info('채팅은 메인 화면에서 열립니다 (미리보기에서는 비활성)')
            }
          />
        </div>
      </main>
    </div>
  );
};

export default LibraryPreview;
