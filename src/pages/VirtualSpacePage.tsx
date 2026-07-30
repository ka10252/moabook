import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, LayoutList, UserRound } from 'lucide-react';
import Phaser from 'phaser';
import { LibraryScene, type RoomManifest } from '@/components/virtual/LibraryScene';
import { CharacterEditor } from '@/components/virtual/CharacterEditor';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { type AvatarConfig, defaultAvatar, normalizeAvatar } from '@/lib/avatar';

const CommunityBoard = lazy(() =>
  import('@/components/community/CommunityBoard').then((m) => ({ default: m.CommunityBoard }))
);
const MemberProfileModal = lazy(() =>
  import('@/components/profile/MemberProfileModal').then((m) => ({ default: m.MemberProfileModal }))
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
  const manifestRef = useRef<RoomManifest | null>(null);
  const nicknameRef = useRef<string>('익명');
  const navigate = useNavigate();
  const { user } = useAuth();

  const channelName = isCommunity ? `space:community:${communityId}` : 'space:global';

  const startScene = (manifest: RoomManifest, avatar: AvatarConfig) => {
    gameRef.current?.scene.start('LibraryScene', {
      manifest,
      assetBase,
      avatar,
      onAction: (action: string) => {
        if (action === 'board') setBoardOpen(true);
      },
      onOpenProfile: (uid: string) => setProfileUserId(uid),
      presence: user
        ? { channelName, me: { userId: user.id, nickname: nicknameRef.current, avatar } }
        : undefined,
    });
  };
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [boardOpen, setBoardOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
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
        manifestRef.current = manifest;

        // 내 아바타 불러오기 (pixel_avatar 컬럼이 없으면 기본값)
        let avatar = defaultAvatar();
        if (user) {
          try {
            const { data } = await supabase.from('profiles').select('pixel_avatar, nickname').eq('id', user.id).maybeSingle();
            const raw = (data as { pixel_avatar?: unknown } | null)?.pixel_avatar;
            avatar = normalizeAvatar(raw);
            const nick = (data as { nickname?: string } | null)?.nickname;
            if (nick) nicknameRef.current = nick;
            // 아직 캐릭터를 안 만든 유저 → 첫 입장 시 에디터를 먼저 띄운다
            if (data && (raw === null || raw === undefined) && !cancelled) setEditorOpen(true);
          } catch { /* 컬럼 미생성 시 기본값 */ }
        }
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
        startScene(manifest, avatar);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetBase, communityId, isCommunity, user]);

  return (
    <div className="fixed inset-0 bg-[#e9e2d0] overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/90 shadow-md text-sm font-medium text-gray-800 hover:bg-white"
      >
        <ArrowLeft className="w-4 h-4" /> 나가기
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-white/85 shadow-sm text-sm font-semibold text-gray-800 max-w-[45vw] truncate">
        {title}
      </div>

      <button
        onClick={() => setEditorOpen(true)}
        className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/90 shadow-md text-sm font-medium text-gray-800 hover:bg-white"
      >
        <UserRound className="w-4 h-4" /> 캐릭터
      </button>

      <CharacterEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={(config) => {
          if (manifestRef.current) startScene(manifestRef.current, config);
        }}
      />

      {profileUserId && (
        <Suspense fallback={null}>
          <MemberProfileModal isOpen={!!profileUserId} onClose={() => setProfileUserId(null)} userId={profileUserId} />
        </Suspense>
      )}


      {isCommunity && (
        <button
          onClick={() => setBoardOpen(true)}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground shadow-lg text-sm font-semibold active:scale-95 transition-transform"
        >
          <LayoutList className="w-4 h-4" />
          게시판 열기
        </button>
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

      {/* CommunityBoard 루트는 h-full 컨테이너(부모를 채움)라, 캔버스 위에 뜨도록
          fixed 오버레이로 감싼다. 앱 기본 콘텐츠 폭(max-w-520)에 맞춰 중앙 폰 크기로 연다. */}
      {isCommunity && communityId && boardOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex justify-center"
          onClick={() => setBoardOpen(false)}
        >
          <div
            className="w-full max-w-[520px] h-full bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Suspense fallback={null}>
              <CommunityBoard
                isOpen
                onClose={() => setBoardOpen(false)}
                communityId={communityId}
                communityName={communityName}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
