import { useEffect, useRef, useState, Suspense } from 'react';
import { lazyRetry } from '@/lib/lazyRetry';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, UserRound, Smile, Send } from 'lucide-react';
import Phaser from 'phaser';
import { LibraryScene, type RoomManifest, type ReadingBook } from '@/components/virtual/LibraryScene';
import { CharacterEditor } from '@/components/virtual/CharacterEditor';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { type AvatarConfig, defaultAvatar, normalizeAvatar } from '@/lib/avatar';

const CommunityBoard = lazyRetry(() =>
  import('@/components/community/CommunityBoard').then((m) => ({ default: m.CommunityBoard }))
);
const MemberProfileModal = lazyRetry(() =>
  import('@/components/profile/MemberProfileModal').then((m) => ({ default: m.MemberProfileModal }))
);
const ReadingBookModal = lazyRetry(() =>
  import('@/components/virtual/ReadingBookModal').then((m) => ({ default: m.ReadingBookModal }))
);

const TOUR_SEEN_KEY = 'moa_room_tour_seen';
/** 사서 안내 단계 — 텍스트는 React가 화면 중앙 픽셀 팝업으로 그린다(상단 UI에 안 가림). */
const TOUR: { text: string; highlight?: 'shelf' | 'board' }[] = [
  { text: '어서 오세요!\n제가 이 방을 안내해 드릴게요 📖' },
  { text: '캐릭터 머리 위에는 각자\n지금 읽는 책이 보여요.\n프로필 › 캐릭터 꾸미기에서 정해요.' },
  { text: '화면 아래에서 이웃에게\n메시지와 이모지를 보낼 수 있어요.' },
  { text: 'Zzz는 접속중이지 않은 이웃이에요.\nZzz가 없으면 접속 중이라\n말을 걸 수 있어요.' },
  { text: '이 책장을 누르면\n우리 커뮤니티의 책을 볼 수 있어요.', highlight: 'shelf' },
  { text: '게시판에서는\n소식을 함께 나눠요.', highlight: 'board' },
  { text: '즐겁게 둘러보세요!\n필요하면 저(관리자)를 다시 눌러주세요 👋' },
];

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
  const readingBookRef = useRef<ReadingBook | null>(null);
  const membersRef = useRef<{ userId: string; nickname: string; avatar: AvatarConfig }[]>([]);

  const fetchReadingBook = async (): Promise<ReadingBook | null> => {
    if (!user) return null;
    // reading_book(jsonb)은 별도 조회 — 컬럼 미생성 시에도 reading_book_id 경로가 살아있게 분리
    const { data: rbData } = await supabase.from('profiles').select('reading_book').eq('id', user.id).maybeSingle();
    const snap = (rbData as { reading_book?: ReadingBook | null } | null)?.reading_book;
    // 새 스냅샷(jsonb) 우선 — 검색으로 지정한 임의의 책 포함
    if (snap?.title) return snap;
    // 구버전 호환: reading_book_id만 있는 유저는 books에서 스냅샷을 만든다
    const { data } = await supabase.from('profiles').select('reading_book_id').eq('id', user.id).maybeSingle();
    const rbid = (data as { reading_book_id?: string | null } | null)?.reading_book_id;
    if (!rbid) return null;
    const { data: bk } = await supabase.from('books').select('id, title, author, cover_url, description').eq('id', rbid).maybeSingle();
    const b = bk as { id: string; title?: string; author?: string; cover_url?: string | null; description?: string | null } | null;
    if (!b) return null;
    return { id: b.id, title: b.title ?? '', author: b.author ?? null, coverUrl: b.cover_url ?? null, description: b.description ?? null };
  };
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
        else if (action === 'shelf' && communityId) navigate(`/?tab=shelf&community=${communityId}`);
      },
      onOpenProfile: (uid: string) => setProfileUserId(uid),
      onOpenReadingBook: (book: ReadingBook) => setReadingBook(book),
      onTourStart: () => setTourStep(0),
      presence: user
        ? { channelName, me: { userId: user.id, nickname: nicknameRef.current, avatar, readingBook: readingBookRef.current } }
        : undefined,
      members: isCommunity ? membersRef.current : undefined,
    });
  };
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [boardOpen, setBoardOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [readingBook, setReadingBook] = useState<ReadingBook | null>(null);
  const [chatText, setChatText] = useState('');
  const [showEmotes, setShowEmotes] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(null);

  const EMOTES = ['👍', '❤️', '😆', '👋', '📚', '✨'];
  const sceneApi = () => gameRef.current?.scene.getScene('LibraryScene') as LibraryScene | undefined;
  const sendChat = () => {
    const t = chatText.trim();
    if (!t) return;
    sceneApi()?.sendBubble(t, false);
    setChatText('');
  };

  // 안내 단계가 바뀌면 해당 가구를 강조(책장/게시판), 끝나면 해제
  useEffect(() => {
    const api = sceneApi();
    if (!api) return;
    api.highlightFurniture(tourStep === null ? null : TOUR[tourStep]?.highlight ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStep]);

  const endTour = () => {
    sceneApi()?.highlightFurniture(null);
    try { localStorage.setItem(TOUR_SEEN_KEY, '1'); } catch { /* ignore */ }
    setTourStep(null);
  };
  const nextTour = () => {
    const n = (tourStep ?? 0) + 1;
    if (n >= TOUR.length) { endTour(); return; }
    setTourStep(n);
  };
  const [communityName, setCommunityName] = useState('');
  const [title, setTitle] = useState(isCommunity ? '버추얼 커뮤니티룸' : '버추얼 도서관');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isCommunity && communityId) {
          // 커뮤니티 정보/멤버 조회 실패는 방 로딩을 막지 않는다(비필수). 실패해도 방은 뜬다.
          try {
            const { data } = await supabase
              .from('communities')
              .select('name')
              .eq('id', communityId)
              .maybeSingle();
            if (!cancelled && data?.name) {
              setCommunityName(data.name);
              setTitle(`${data.name} · 버추얼 커뮤니티룸`);
            }
            // 멤버 전원(미접속자는 zzz로 방에 표시)
            const { data: mem } = await supabase
              .from('community_members')
              .select('user_id, profile:profiles(nickname, pixel_avatar)')
              .eq('community_id', communityId)
              .eq('is_banned', false);
            membersRef.current = ((mem ?? []) as Array<{ user_id: string; profile: { nickname?: string; pixel_avatar?: unknown } | null }>).map((r) => ({
              userId: r.user_id,
              nickname: r.profile?.nickname ?? '멤버',
              avatar: normalizeAvatar(r.profile?.pixel_avatar),
            }));
          } catch (e) {
            console.error('community info load failed (non-fatal):', e);
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
            readingBookRef.current = await fetchReadingBook();
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

      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {/* 게시판 버튼 제거 — 방 안의 게시판 가구를 눌러 접근 */}
        <button
          onClick={() => setEditorOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/90 shadow-md text-sm font-medium text-gray-800 hover:bg-white"
        >
          <UserRound className="w-4 h-4" /> 캐릭터
        </button>
      </div>

      <CharacterEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={async (config) => {
          readingBookRef.current = await fetchReadingBook();
          if (manifestRef.current) startScene(manifestRef.current, config);
        }}
      />

      {profileUserId && (
        <Suspense fallback={null}>
          <MemberProfileModal
            isOpen={!!profileUserId}
            onClose={() => setProfileUserId(null)}
            userId={profileUserId}
            onBookClick={(book) => { setProfileUserId(null); navigate(`/?tab=shelf&book=${book.id}`); }}
          />
        </Suspense>
      )}

      {readingBook && (
        <Suspense fallback={null}>
          <ReadingBookModal book={readingBook} onClose={() => setReadingBook(null)} />
        </Suspense>
      )}


      {/* 하단 채팅/이모트 바 (근접 대화·이모트 → 머리 위 말풍선) */}
      {user && !loading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 w-[calc(100%-2rem)] max-w-[460px]">
          {showEmotes && (
            <div className="absolute bottom-14 left-0 flex gap-1 bg-white/95 rounded-2xl shadow-lg p-2">
              {EMOTES.map((e) => (
                <button
                  key={e}
                  onClick={() => { sceneApi()?.sendBubble(e, true); setShowEmotes(false); }}
                  className="text-xl w-9 h-9 rounded-lg hover:bg-gray-100 leading-none"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowEmotes((v) => !v)}
            className="shrink-0 w-11 h-11 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:bg-white"
            aria-label="이모트"
          >
            <Smile className="w-5 h-5 text-gray-700" />
          </button>
          <input
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
            placeholder="메시지 보내기…"
            maxLength={60}
            className="flex-1 h-11 px-4 rounded-full bg-white/95 shadow-md text-sm text-gray-800 outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={sendChat}
            className="shrink-0 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center active:scale-95"
            aria-label="전송"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* 사서 안내 — 화면 중앙 픽셀 팝업(상단 UI에 안 가림, 픽셀톤 유지) */}
      {tourStep !== null && (
        <div
          className="absolute inset-0 z-[70] flex items-start justify-center bg-black/25"
          style={{ paddingTop: '30vh' }}
          onClick={endTour}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative mx-4 w-[min(84vw,320px)] bg-white border-2 border-[#3a2d22] shadow-[4px_4px_0_0_#3a2d22]"
            style={{ fontFamily: 'Galmuri11, monospace', imageRendering: 'pixelated' }}
          >
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[#F26A4B] text-white text-[13px] border-b-2 border-[#3a2d22]">
              <span>📖</span>
              <span>관리자의 안내</span>
              <span className="ml-auto text-[11px] opacity-90">{(tourStep ?? 0) + 1} / {TOUR.length}</span>
            </div>
            <p className="px-4 py-5 text-[13px] leading-6 text-[#2c2621] text-center whitespace-pre-line">
              {TOUR[tourStep]?.text}
            </p>
            <div className="flex border-t-2 border-[#3a2d22]">
              <button
                onClick={endTour}
                className="flex-1 py-2.5 text-[12px] text-[#6b5d50] border-r-2 border-[#3a2d22] active:bg-gray-100"
              >
                닫기
              </button>
              <button
                onClick={nextTour}
                className="flex-1 py-2.5 text-[12px] font-semibold text-[#F26A4B] active:bg-[#fff0ec]"
              >
                {tourStep === TOUR.length - 1 ? '완료' : '다음 ▶'}
              </button>
            </div>
          </div>
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
