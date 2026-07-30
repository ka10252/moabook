import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Phaser from 'phaser';
import { LibraryScene, type RoomManifest } from '@/components/virtual/LibraryScene';

/**
 * 가상 도서관 페이지. manifest를 불러와 Phaser 게임을 부팅한다.
 * 전체화면 캔버스 + 좌상단 뒤로가기.
 */
export default function VirtualSpacePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/assets/library/manifest.json');
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
        gameRef.current.scene.start('LibraryScene', { manifest });
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
  }, []);

  return (
    <div className="fixed inset-0 bg-[#e9e2d0] overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/90 shadow-md text-sm font-medium text-gray-800 hover:bg-white"
      >
        <ArrowLeft className="w-4 h-4" /> 나가기
      </button>

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
    </div>
  );
}
