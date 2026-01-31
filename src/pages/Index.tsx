import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookshelf } from '@/components/Bookshelf';
import { BottomNav } from '@/components/BottomNav';
import { UploadPage } from '@/components/upload/UploadPage';
import { CommunityPage } from '@/components/community/CommunityPage';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { WishlistPage } from '@/components/wishlist/WishlistPage';
import { ChatModal } from '@/components/chat/ChatModal';
import { NotificationPopup } from '@/components/notifications/NotificationPopup';
import { AuthPage } from '@/pages/AuthPage';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { Loader2, MessageCircle, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

type NavItem = 'shelf' | 'wishlist' | 'upload' | 'community' | 'profile';

const Index = () => {
  const [activeTab, setActiveTab] = useState<NavItem>('shelf');
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatInitialUserId, setChatInitialUserId] = useState<string | null>(null);
  const [chatInitialBookId, setChatInitialBookId] = useState<string | null>(null);
  const [chatBookMode, setChatBookMode] = useState<'rent' | 'sell' | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const { user, loading, signOut } = useAuth();
  const { unreadCount } = useNotifications();

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

  const renderContent = () => {
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
        return <CommunityPage onNavigateToBookshelf={handleNavigateToBookshelf} />;
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

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show auth page if not logged in
  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <img 
            src="/moa-logo.png" 
            alt="Moa" 
            className="h-8"
          />
          
          <div className="flex items-center gap-1">
            {/* Notification Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNotifications(true)}
              className="relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>

            {/* Chat Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowChatModal(true)}
              className="relative"
            >
              <MessageCircle className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pt-14 pb-20 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Chat Modal */}
      <ChatModal 
        isOpen={showChatModal} 
        onClose={handleCloseChat}
        initialUserId={chatInitialUserId}
        initialBookId={chatInitialBookId}
        initialBookMode={chatBookMode}
        onResetInitialValues={handleResetChatInitialValues}
      />

      {/* Notification Popup */}
      <NotificationPopup
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </div>
  );
};

export default Index;
