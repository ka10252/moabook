import { useState, useEffect, useCallback, Suspense } from 'react';
import { lazyRetry } from '@/lib/lazyRetry';
import { track, trackSessionStart } from '@/lib/analytics';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookshelf } from '@/components/Bookshelf';
import { BottomNav } from '@/components/BottomNav';
import { PullToRefresh } from '@/components/PullToRefresh';

// 유저는 한 번에 탭 하나만 본다. 첫 화면(책장)만 즉시 로드하고
// 나머지 탭·오버레이는 실제로 열 때 내려받는다.
const UploadPage = lazyRetry(() => import('@/components/upload/UploadPage').then(m => ({ default: m.UploadPage })));
const CommunityPage = lazyRetry(() => import('@/components/community/CommunityPage').then(m => ({ default: m.CommunityPage })));
const ProfilePage = lazyRetry(() => import('@/components/profile/ProfilePage').then(m => ({ default: m.ProfilePage })));
const WishlistPage = lazyRetry(() => import('@/components/wishlist/WishlistPage').then(m => ({ default: m.WishlistPage })));
const ChatModal = lazyRetry(() => import('@/components/chat/ChatModal').then(m => ({ default: m.ChatModal })));
const CommunityBoard = lazyRetry(() => import('@/components/community/CommunityBoard').then(m => ({ default: m.CommunityBoard })));
import { OnboardingModal } from '@/components/OnboardingModal';
import { NotificationPopup } from '@/components/notifications/NotificationPopup';
import { AnnouncementPopup } from '@/components/notifications/AnnouncementPopup';
import { useAuth } from '@/hooks/useAuth';
import { useGuestGate } from '@/hooks/useGuestGate';
import { useBackClose } from '@/hooks/useBackClose';
import { useNotifications } from '@/hooks/useNotifications';
import { useChat } from '@/hooks/useChat';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, MessageCircle, Bell, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'react-router-dom';
import { BookMode } from '@/lib/bookMode';

type NavItem = 'shelf' | 'wishlist' | 'upload' | 'community' | 'profile';

const TabFallback = () => (
  <div className="h-full flex items-center justify-center">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
);

const Header = ({
  unreadCount,
  unreadMessageCount,
  hasNewAnnouncement,
  onOpenNotifications,
  onOpenAnnouncements,
  onOpenChat,
  markAnnouncementAsSeen,
  onLogoClick,
}: {
  unreadCount: number;
  unreadMessageCount: number;
  hasNewAnnouncement: boolean;
  onOpenNotifications: () => void;
  onOpenAnnouncements: () => void;
  onOpenChat: () => void;
  markAnnouncementAsSeen: () => void;
  onLogoClick: () => void;
}) => (
  <header className="safe-top fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
    {/* 헤더는 로고와 아이콘 셋뿐이라 56px 은 과했다 → 48px */}
    <div className="flex items-center justify-between px-4 h-12 max-w-[520px] mx-auto w-full">
      <img src="/moa-logo.png"      alt="MOA Book" className="h-8 block dark:hidden cursor-pointer" onClick={onLogoClick} />
      <img src="/moa-logo-dark.png" alt="MOA Book" className="h-8 hidden dark:block cursor-pointer" onClick={onLogoClick} />
      
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            onOpenAnnouncements();
            markAnnouncementAsSeen();
          }}
          className="relative"
        >
          <Mail className="w-5 h-5" />
          {hasNewAnnouncement && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenNotifications}
          className="relative"
          data-onboarding="bell"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenChat}
          className="relative"
        >
          <MessageCircle className="w-5 h-5" />
          {unreadMessageCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-[hsl(var(--destructive))] text-white text-xs font-bold rounded-full flex items-center justify-center border border-white shadow-sm">
              {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
            </span>
          )}
        </Button>
      </div>
    </div>
  </header>
);

const TABS: NavItem[] = ['shelf', 'wishlist', 'upload', 'community', 'profile'];

const Index = () => {
  /**
   * 탭·오버레이 상태를 URL에 싣는다.
   *
   * 예전에는 전부 useState라서 브라우저 히스토리에 아무것도 안 쌓였다.
   * 그래서 책장 → 등록 → 프로필을 아무리 오래 돌아다녀도 히스토리는 항목 1개뿐이었고,
   * 뒤로가기를 누르면 "이전 탭"이 아니라 "moabook 이전 사이트(구글)"로 나가버렸다.
   * 탭을 URL(?tab=)에 올리면 각 이동이 히스토리 항목이 되어 뒤로가기가 자연스럽게 작동한다.
   */
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as NavItem | null;
  const activeTab: NavItem = tabParam && TABS.includes(tabParam) ? tabParam : 'shelf';

  const showChatModal = searchParams.get('chat') === '1';
  const boardId = searchParams.get('board');
  // 커뮤니티 책장 필터를 URL로 (버추얼 커뮤니티룸의 책장 클릭에서도 열 수 있게)
  const communityParam = searchParams.get('community');

  /** URL의 다른 파라미터(?onboarding 등)는 건드리지 않고 일부만 바꾼다 */
  const patchParams = useCallback(
    (patch: Record<string, string | null>, opts?: { replace?: boolean }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null) next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: opts?.replace ?? false }
      );
    },
    [setSearchParams]
  );

  const [chatInitialUserId, setChatInitialUserId] = useState<string | null>(null);
  const [chatInitialConversationId, setChatInitialConversationId] = useState<string | null>(null);
  const [chatInitialBookId, setChatInitialBookId] = useState<string | null>(null);
  const [chatBookMode, setChatBookMode] = useState<BookMode | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  // 게시판 이름은 URL에 싣지 않는다 (지저분해진다) — id만 URL, 이름은 메모리에 둔다.
  const [boardName, setBoardName] = useState<string | null>(null);
  // 새로고침하면 boardName(state)은 사라지지만 boardId(URL)는 남는다. 예전엔 이름이 없으면
  // boardPage=null이 돼 게시판이 닫히고 커뮤니티 탭으로 보였다 → boardId만으로 열고 이름은 아래서 채운다.
  const boardPage = boardId ? { communityId: boardId, communityName: boardName ?? '' } : null;

  // 새로고침 복원: boardId만 있고 이름이 없으면 커뮤니티 이름을 조회해 채운다.
  useEffect(() => {
    if (!boardId || boardName) return;
    let cancelled = false;
    supabase.from('communities').select('name').eq('id', boardId).maybeSingle()
      .then(({ data }) => { if (!cancelled && data?.name) setBoardName(data.name); });
    return () => { cancelled = true; };
  }, [boardId, boardName]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { user, loading, signOut } = useAuth();
  const { isGuest, trackBrowse, requireAuth } = useGuestGate();

  const goToTab = useCallback((tab: NavItem) => patchParams({ tab, board: null, chat: null }), [patchParams]);

  // 앱을 연 것 자체를 한 번 남긴다. 게스트 포함 — 전환 퍼널의 시작점이다.
  useEffect(() => {
    trackSessionStart();
  }, []);

  // 어느 탭을 보는지. 리텐션·기능별 관심도의 기본 신호.
  useEffect(() => {
    track('tab_viewed', { tab: activeTab });
  }, [activeTab]);

  // 뒤로가기 = 떠 있는 팝업부터 닫기 (탭·채팅·게시판은 URL에 있어 이미 히스토리로 처리된다)
  useBackClose(showNotifications, () => setShowNotifications(false));
  useBackClose(showAnnouncement, () => setShowAnnouncement(false));

  // Show onboarding only for accounts created within the last 24 hours (new signups).
  // Existing users get their localStorage key set automatically so it never shows.
  const handleOnboardingComplete = () => {
    if (user) localStorage.setItem(`moa_onboarded_${user.id}`, '1');
    setShowOnboarding(false);
  };

  // FAQ '온보딩 다시 보기' → 책장 탭으로 이동 후 온보딩 재생(스포트라이트 대상이 책장에 있음)
  useEffect(() => {
    const replay = () => { goToTab('shelf'); setShowOnboarding(true); };
    window.addEventListener('moa:replay-onboarding', replay);
    return () => window.removeEventListener('moa:replay-onboarding', replay);
  }, [goToTab]);
  // ⚠️ `window.location.search` 를 직접 읽지 않는다.
  //    네이티브 앱에서는 링크가 새 페이지를 여는 게 아니라 **이미 떠 있는 화면 안에서**
  //    경로만 바뀐다(딥링크 → navigate). window 를 읽고 deps 에 안 넣으면 그 효과가 다시 돌지 않아
  //    링크를 눌러도 아무 일도 일어나지 않는다. 라우터가 주는 값을 쓰고 deps 에 넣는다.
  const onboardingParam = searchParams.has('onboarding');
  const inviteToken = searchParams.get('invite');

  useEffect(() => {
    // ?onboarding=1 → 로그인 여부와 무관하게 온보딩을 다시 볼 수 있다 (검수·디자인 확인용)
    if (onboardingParam) {
      setShowOnboarding(true);
      return;
    }

    if (!user) return;

    const key = `moa_onboarded_${user.id}`;
    if (localStorage.getItem(key)) return;

    const accountAgeMs = Date.now() - new Date(user.created_at).getTime();
    const isNewUser = accountAgeMs < 24 * 60 * 60 * 1000; // 24시간 이내 가입

    // 신규 유저면 온보딩을 띄우되, "띄우는 즉시" 본 것으로 표시한다.
    // (완료 때만 표시하면 중간에 닫거나 재진입 시 24시간 내내 다시 떠서 매번 나오는 버그)
    if (isNewUser) setShowOnboarding(true);
    localStorage.setItem(key, '1');
  }, [user?.id, onboardingParam]);

  /**
   * 구글로 막 가입한 사람은 닉네임이 없다.
   *
   * 프로필 생성 트리거가 임시 닉네임(`User_abc12345`)을 넣어주는데, 그대로 두면
   * 서가·채팅에 그 이름이 그대로 뜬다. 그 모양이면 한 번은 정하게 해야 한다.
   * (이메일 가입은 폼에서 닉네임을 받으므로 여기 안 걸린다)
   */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('profiles').select('nickname').eq('id', user.id).single();
      if (cancelled || !data) return;
      if (/^User_[0-9a-f]{8}$/i.test(data.nickname ?? '')) {
        goToTab('profile');
        toast.info('닉네임을 정해주세요', { description: '이웃에게 이 이름으로 보여요.' });
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, goToTab]);

  // 커뮤니티 초대 링크: ?invite=TOKEN
  //
  // ⚠️ 초대 링크는 **경로 없이 쿼리만** 있다(`https://…/?invite=TOK`). 웹에서는 링크를 누르면
  //    페이지가 새로 뜨니 마운트 때 한 번 읽으면 됐지만, 앱에서는 이미 떠 있는 화면에
  //    쿼리만 갈아끼운다 — 그래서 `inviteToken` 을 deps 에 넣어야 링크가 먹는다.
  useEffect(() => {
    if (!user || !inviteToken) return;
    const token = inviteToken;
    // 파라미터를 먼저 지운다 — 새로고침이나 재실행에서 또 부르지 않게.
    // history 를 직접 건드리면 라우터가 모르는 상태가 되므로 라우터로 지운다.
    patchParams({ invite: null }, { replace: true });
    (async () => {
      const { data, error } = await supabase.rpc('join_via_invite' as any, { p_token: token });
      if (error || !data) { toast.error('초대 링크가 유효하지 않습니다'); return; }
      const result = data as any;
      if (!result.success) {
        if (result.error === 'banned') toast.error('해당 커뮤니티에서 차단된 상태입니다');
        else toast.error('초대 링크가 만료되었거나 유효하지 않습니다');
        return;
      }
      if (result.already_member) {
        toast.info(`이미 "${result.community_name}" 멤버입니다`);
      } else {
        toast.success(`"${result.community_name}"에 가입했습니다!`);
      }
      goToTab('community');
    })();
  }, [user?.id, inviteToken, patchParams, goToTab]);

  const { unreadCount } = useNotifications();
  const { totalUnreadCount: unreadMessageCount } = useChat();
  const { hasNewAnnouncement, markAsSeen } = useAnnouncement();

  const handleOpenChat = (userId: string, bookId: string, bookMode: BookMode) => {
    setChatInitialUserId(userId);
    setChatInitialConversationId(null);
    setChatInitialBookId(bookId);
    setChatBookMode(bookMode);
    patchParams({ chat: '1' });
  };

  const handleCloseChat = () => {
    patchParams({ chat: null });
    setChatInitialUserId(null);
    setChatInitialConversationId(null);
    setChatInitialBookId(null);
    setChatBookMode(null);
  };

  const handleResetChatInitialValues = () => {
    setChatInitialUserId(null);
    setChatInitialConversationId(null);
    setChatInitialBookId(null);
    setChatBookMode(null);
  };

  // URL의 community 파라미터를 책장 필터에 반영 (외부/버추얼룸에서 진입 가능)
  useEffect(() => {
    setSelectedCommunityId(communityParam);
  }, [communityParam]);

  const handleNavigateToBookshelf = (communityId: string) => {
    patchParams({ tab: 'shelf', community: communityId, board: null, chat: null });
  };

  const contentKey = boardPage
    ? `board-${boardPage.communityId}`
    : activeTab;

  const renderContent = () => {
    if (boardPage) {
      return (
        <CommunityBoard
          isOpen={true}
          onClose={() => patchParams({ board: null })}
          communityId={boardPage.communityId}
          communityName={boardPage.communityName}
        />
      );
    }
    switch (activeTab) {
      case 'shelf':
        return (
          <Bookshelf
            onOpenChat={handleOpenChat}
            initialCommunityId={selectedCommunityId}
            onCommunityFilterClear={() => patchParams({ community: null })}
            openBookId={searchParams.get('book')}
            openTransactions={searchParams.get('tx') === '1'}
            onDeepLinkConsumed={() => patchParams({ book: null, tx: null }, { replace: true })}
          />
        );
      case 'wishlist':
        return <WishlistPage />;
      case 'upload':
        return <UploadPage onUploaded={() => goToTab('shelf')} />;
      case 'community':
        return (
          <CommunityPage
            onNavigateToBookshelf={handleNavigateToBookshelf}
            onOpenBoard={(id, name) => {
              setBoardName(name);
              patchParams({ board: id });
            }}
            onOpenChatForBook={handleOpenChat}
          />
        );
      case 'profile':
        return <ProfilePage onSignOut={signOut} />;
      default:
        return (
          <Bookshelf
            onOpenChat={handleOpenChat}
            initialCommunityId={selectedCommunityId}
            onCommunityFilterClear={() => patchParams({ community: null })}
            openBookId={searchParams.get('book')}
            openTransactions={searchParams.get('tx') === '1'}
            onDeepLinkConsumed={() => patchParams({ book: null, tx: null }, { replace: true })}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // 게스트도 앱을 그대로 본다 (로그인 벽 없음).
  // 가입 유도는 GuestGate가 담당: 둘러보기 3회 → 권유 팝업, 쓰기 동작 → 즉시 요구.

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        unreadCount={unreadCount}
        unreadMessageCount={unreadMessageCount}
        hasNewAnnouncement={hasNewAnnouncement}
        onOpenNotifications={() => setShowNotifications(true)}
        onOpenAnnouncements={() => setShowAnnouncement(true)}
        onOpenChat={() => patchParams({ chat: '1' })}
        markAnnouncementAsSeen={markAsSeen}
        onLogoClick={() => {
          goToTab('shelf');
        }}
      />

      <PullToRefresh enabled={!showChatModal} />

      {/* 고정 헤더(3rem)와 탭바(3.5rem)만큼 비워둔다. 노치·홈 인디케이터가 있는 폰에서는
          둘 다 안전영역만큼 더 커지므로 env()를 같이 더한다 — 안 하면 아래쪽 내용이 탭바 뒤로 숨는다.
          웹에서는 env()가 0이라 예전과 같다. */}
      <main
        className="flex-1"
        style={{
          paddingTop: 'calc(3rem + var(--safe-top))',   // 헤더 h-12 와 맞춘다
          paddingBottom: 'calc(3.5rem + var(--safe-bottom))',   // 탭바 min-h-14 와 맞춘다
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={contentKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="min-h-full max-w-[520px] mx-auto w-full"
          >
            <Suspense fallback={<TabFallback />}>{renderContent()}</Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          // 게스트: 등록·프로필은 계정이 없으면 화면 자체가 열리지 않는다 → '페이지' 사유로 안내
          if (isGuest && (tab === 'upload' || tab === 'profile')) {
            requireAuth('page');
            return;
          }
          trackBrowse();
          goToTab(tab);
        }}
      />

      {/* 알림 설정 유도는 온보딩 + 벨 팝업 상단 카드로 이동함(화면마다 따라다니던 배너 제거) */}

      {/* Chat overlay — fixed so it's immune to main's pb-20 */}
      {showChatModal && (
        <div data-ptr-ignore className="fixed inset-x-0 top-12 bottom-14 z-[45] bg-background overflow-hidden">
          <div className="h-full max-w-[520px] mx-auto w-full">
            <Suspense fallback={<TabFallback />}>
              <ChatModal
                isOpen={true}
                onClose={handleCloseChat}
                initialUserId={chatInitialUserId}
                initialConversationId={chatInitialConversationId}
                initialBookId={chatInitialBookId}
                initialBookMode={chatBookMode}
                onResetInitialValues={handleResetChatInitialValues}
              />
            </Suspense>
          </div>
        </div>
      )}

      <NotificationPopup
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onOpenChat={({ userId, conversationId }) => {
          setShowNotifications(false);
          setChatInitialUserId(userId || null);
          setChatInitialConversationId(conversationId ?? null);
          setChatInitialBookId(null);
          setChatBookMode(null);
          patchParams({ chat: '1' });
        }}
        // 알림 딥링크는 URL로 넘긴다 → 뒤로가기도 자연스럽게 동작한다
        onOpenBook={(bookId) => {
          setShowNotifications(false);
          patchParams({ tab: 'shelf', book: bookId, chat: null, board: null });
        }}
        onOpenTransactions={() => {
          setShowNotifications(false);
          patchParams({ tab: 'shelf', tx: '1', chat: null, board: null });
        }}
        onOpenCommunity={() => {
          setShowNotifications(false);
          patchParams({ tab: 'community', book: null, tx: null, chat: null, board: null });
        }}
        onOpenAnnouncement={() => {
          setShowNotifications(false);
          setShowAnnouncement(true);
        }}
      />

      <AnnouncementPopup
        isOpen={showAnnouncement}
        onClose={() => setShowAnnouncement(false)}
      />

      {/* 온보딩은 실제 앱 화면 위에 스포트라이트로 얹힌다 (설명 중인 요소만 밝게 남는다) */}
      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
    </div>
  );
};

export default Index;
