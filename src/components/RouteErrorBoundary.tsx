import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

/**
 * 라우트/탭 렌더 중 에러가 나도 앱 전체가 하얀 화면이 되지 않게 막는 안전망.
 * 특히 새 배포 후 옛 청크 로드 실패(ChunkLoadError)를 잡아 새로고침을 유도한다.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // 청크 로드 실패는 대개 새 배포 때문 → 1회 자동 새로고침(lazyRetry와 동일 플래그로 루프 방지)
    const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    const isChunkError = /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed/i.test(msg);
    if (isChunkError && !sessionStorage.getItem('moa_chunk_reloaded')) {
      sessionStorage.setItem('moa_chunk_reloaded', '1');
      window.location.reload();
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-background">
        <p className="text-sm text-muted-foreground">화면을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p>
        <button
          onClick={() => { sessionStorage.removeItem('moa_chunk_reloaded'); window.location.reload(); }}
          className="h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
        >
          새로고침
        </button>
      </div>
    );
  }
}
