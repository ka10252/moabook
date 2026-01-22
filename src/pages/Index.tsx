import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookshelf } from '@/components/Bookshelf';
import { BottomNav } from '@/components/BottomNav';
import { UploadPage } from '@/components/upload/UploadPage';
import { CommunityPage } from '@/components/community/CommunityPage';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { WishlistPage } from '@/components/wishlist/WishlistPage';
import { ChatModal } from '@/components/chat/ChatModal';
import { AuthPage } from '@/pages/AuthPage';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type NavItem = 'shelf' | 'wishlist' | 'upload' | 'community' | 'profile';

const Index = () => {
  const [activeTab, setActiveTab] = useState<NavItem>('shelf');
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatInitialUserId, setChatInitialUserId] = useState<string | null>(null);
  const [chatInitialBookId, setChatInitialBookId] = useState<string | null>(null);
  const { user, loading, signOut } = useAuth();

  const handleOpenChat = (userId: string, bookId: string) => {
    setChatInitialUserId(userId);
    setChatInitialBookId(bookId);
    setShowChatModal(true);
  };

  const handleCloseChat = () => {
    setShowChatModal(false);
    setChatInitialUserId(null);
    setChatInitialBookId(null);
  };

  const handleResetChatInitialValues = () => {
    setChatInitialUserId(null);
    setChatInitialBookId(null);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'shelf':
        return <Bookshelf onOpenChat={handleOpenChat} />;
      case 'wishlist':
        return <WishlistPage />;
      case 'upload':
        return <UploadPage />;
      case 'community':
        return <CommunityPage />;
      case 'profile':
        return <ProfilePage onSignOut={signOut} />;
      default:
        return <Bookshelf onOpenChat={handleOpenChat} />;
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
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            Moa 📚
          </h1>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowChatModal(true)}
            className="relative"
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
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
        onResetInitialValues={handleResetChatInitialValues}
      />
    </div>
  );
};

export default Index;
