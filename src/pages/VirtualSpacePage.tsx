import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Phaser from 'phaser';
import { LibraryScene, type RoomManifest } from '@/components/virtual/LibraryScene';
import { supabase } from '@/integrations/supabase/client';

const CommunityBoard = lazy(() =>
  import('@/components/community/CommunityBoard').then((m) => ({ default: m.CommunityBoard }))
);

/**
 * 가상 공간 페이지 (Phaser).
 * - /space              → 전체 가상 도서관
 * - /space/community/:id → 커뮤니티 방 (게시판 오브젝트 클릭 → 커뮤니티 게시판)
 */
export default function VirtualSpacePage() {
  const { communityId } = useParams<{ communityId?: string }>();
  const isCommunity = !!communityId;
  const assetBase = isCommunity ? '/assets/community' : '/assets/library';

  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [boardOpen, setBoardOpen] = useState(false);
  const [communityName, setCommunityName] = useState('');
  const [title, setTitle] = useState(isCommunity ? '버추얼 커뮤니티룸' : '버추얼 도서관');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isCommunity && communityId) {
          const { data } = await supabase
            .from('communities')
            .select('name')
            .eq('id', communityId)
            .maybeSingle();
          if (!cancelled && data?.name) {
            setCommunityName(data.name);
            setTitle(`${data.name} · 버추얼 커뮤니티룸`);
          }
        }
        const res = await fetch(`${assetBase}/manifest.json`);
        if (!res.ok) throw new Error('manifest 로드 실패');
        const manifest: RoomManifest = await res.json();
        if (cancelled || !containerRef.current) return;

        gameRef.current = new Phaser.Game({
          type: Phaser.AUTO,
          parent: containerRef.current,
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
          pixelArt: true,
          backgroundColor: '#e9e2d0',
          physics: { default: 'arcade', arcade: { debug: false } },
          scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
          scene: LibraryScene,
        });
        gameRef.current.scene.start('LibraryScene', {
          manifest,
          assetBase,
          onAction: (action: string) => {
            if (action === 'board') setBoardOpen(true);
          },
        });
        setLoading(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : '오류');
      }
    })();

    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [assetBase, communityId, isCommunity]);

  return (
    <div className="fixed inset-0 bg-[#e9e2d0] overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/90 shadow-md text-sm font-medium text-gray-800 hover:bg-white"
      >
        <ArrowLeft className="w-4 h-4" /> 나가기
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-white/85 shadow-sm text-sm font-semibold text-gray-800 max-w-[60vw] truncate">
        {title}
      </div>

      {isCommunity && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-black/55 text-white text-xs">
벽의 게시판을 탭하면 커뮤니티 게시판이 열려요
        </div>
      )}

      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-600">
          공간을 불러오지 못했어요: {error}
        </div>
      )}

      {isCommunity && communityId && (
        <Suspense fallback={null}>
          <CommunityBoard
            isOpen={boardOpen}
            onClose={() => setBoardOpen(false)}
            communityId={communityId}
            communityName={communityName}
          />
        </Suspense>
      )}
    </div>
  );
}
