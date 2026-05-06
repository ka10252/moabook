import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookshelf } from '@/components/Bookshelf';
import { BottomNav } from '@/components/BottomNav';
import { UploadPage } from '@/components/upload/UploadPage';
import { CommunityPage } from '@/components/community/CommunityPage';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { WishlistPage } from '@/components/wishlist/WishlistPage';
import { ChatModal } from '@/components/chat/ChatModal';
import { CommunityBoard } from '@/components/community/CommunityBoard';
import { OnboardingModal } from '@/components/OnboardingModal';
import { NotificationPopup } from '@/components/notifications/NotificationPopup';
import { AnnouncementPopup } from '@/components/notifications/AnnouncementPopup';
import { AuthPage } from '@/pages/AuthPage';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useChat } from '@/hooks/useChat';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, MessageCircle, Bell, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

type NavItem = 'shelf' | 'wishlist' | 'upload' | 'community' | 'profile';

const Header = ({ 
  unreadCount, 
  unreadMessageCount, 
  hasNewAnnouncement, 
  onOpenNotifications, 
  onOpenAnnouncements, 
  onOpenChat,
  markAnnouncementAsSeen
}: {
  unreadCount: number;
  unreadMessageCount: number;
  hasNewAnnouncement: boolean;
  onOpenNotifications: () => void;
  onOpenAnnouncements: () => void;
  onOpenChat: () => void;
  markAnnouncementAsSeen: () => void;
}) => (
  <header className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
    <div className="flex items-center justify-between px-4 h-14 max-w-[520px] mx-auto w-full">
      <img src="/moa-logo.png"      alt="Moa" className="h-8 block dark:hidden" />
      <img src="/moa-logo-dark.png" alt="Moa" className="h-8 hidden dark:block" />
      
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

const Index = () => {
  // Default to 'shelf' (Bookshelf) as the first screen after login
  const [activeTab, setActiveTab] = useState<NavItem>('shelf');
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatInitialUserId, setChatInitialUserId] = useState<string | null>(null);
  const [chatInitialBookId, setChatInitialBookId] = useState<string | null>(null);
  const [chatBookMode, setChatBookMode] = useState<'rent' | 'sell' | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [boardPage, setBoardPage] = useState<{ communityId: string; communityName: string } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  const { user, loading, signOut } = useAuth();

  // Show onboarding only for accounts created within the last 24 hours (new signups).
  // Existing users get their localStorage key set automatically so it never shows.
  const handleOnboardingComplete = () => {
    if (user) localStorage.setItem(`moa_onboarded_${user.id}`, '1');
    setShowOnboarding(false);
  };
  useEffect(() => {
    if (!user) return;
    const key = `moa_onboarded_${user.id}`;
    if (localStorage.getItem(key)) return;

    const accountAgeMs = Date.now() - new Date(user.created_at).getTime();
    const isNewUser = accountAgeMs < 24 * 60 * 60 * 1000; // 24시간 이내 가입

    if (isNewUser) {
      setShowOnboarding(true);
    } else {
      // 기존 유저 — 온보딩 본 것으로 처리해 다시 표시 안 함
      localStorage.setItem(key, '1');
    }
  }, [user?.id]);

  // Handle community invite link: ?invite=TOKEN
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (!token) return;
    // Remove the query param immediately so reload won't re-trigger
    window.history.replaceState({}, '', window.location.pathname);
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
      setActiveTab('community');
    })();
  }, [user?.id]);

  const { unreadCount } = useNotifications();
  const { totalUnreadCount: unreadMessageCount } = useChat();
  const { hasNewAnnouncement, markAsSeen } = useAnnouncement();

  const handleOpenChat = (userId: string, bookId: string, bookMode: 'rent' | 'sell') => {
    setChatInitialUserId(userId);
    setChatInitialBookId(bookId);
    setChatBookMode(bookMode);
    setShowChatModal(true);
  };

  const handleCloseChat = () => {
    setShowChatModal(false);
    setChatInitialUserId(null);
    setChatInitialBookId(null);
    setChatBookMode(null);
  };

  const handleResetChatInitialValues = () => {
    setChatInitialUserId(null);
    setChatInitialBookId(null);
    setChatBookMode(null);
  };

  const handleNavigateToBookshelf = (communityId: string) => {
    setSelectedCommunityId(communityId);
    setActiveTab('shelf');
  };

  const contentKey = boardPage
    ? `board-${boardPage.communityId}`
    : activeTab;

  const renderContent = () => {
    if (boardPage) {
      return (
        <CommunityBoard
          isOpen={true}
          onClose={() => setBoardPage(null)}
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
            onCommunityFilterClear={() => setSelectedCommunityId(null)}
          />
        );
      case 'wishlist':
        return <WishlistPage />;
      case 'upload':
        return <UploadPage />;
      case 'community':
        return (
          <CommunityPage
            onNavigateToBookshelf={handleNavigateToBookshelf}
            onOpenBoard={(id, name) => setBoardPage({ communityId: id, communityName: name })}
          />
        );
      case 'profile':
        return <ProfilePage onSignOut={signOut} />;
      default:
        return (
          <Bookshelf
            onOpenChat={handleOpenChat}
            initialCommunityId={selectedCommunityId}
            onCommunityFilterClear={() => setSelectedCommunityId(null)}
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

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header 
        unreadCount={unreadCount}
        unreadMessageCount={unreadMessageCount}
        hasNewAnnouncement={hasNewAnnouncement}
        onOpenNotifications={() => setShowNotifications(true)}
        onOpenAnnouncements={() => setShowAnnouncement(true)}
        onOpenChat={() => setShowChatModal(true)}
        markAnnouncementAsSeen={markAsSeen}
      />

      <main className="flex-1 pt-14 pb-20 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={contentKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full max-w-[520px] mx-auto w-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Chat overlay — fixed so it's immune to main's pb-20 */}
      {showChatModal && (
        <div className="fixed inset-x-0 top-14 bottom-20 z-[45] bg-background overflow-hidden">
          <div className="h-full max-w-[520px] mx-auto w-full">
            <ChatModal
              isOpen={true}
              onClose={handleCloseChat}
              initialUserId={chatInitialUserId}
              initialBookId={chatInitialBookId}
              initialBookMode={chatBookMode}
              onResetInitialValues={handleResetChatInitialValues}
            />
          </div>
        </div>
      )}

      <NotificationPopup
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      <AnnouncementPopup
        isOpen={showAnnouncement}
        onClose={() => setShowAnnouncement(false)}
      />

      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
    </div>
  );
};

export default Index;
