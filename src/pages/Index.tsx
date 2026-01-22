import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookshelf } from '@/components/Bookshelf';
import { BottomNav } from '@/components/BottomNav';
import { PlaceholderTab } from '@/components/PlaceholderTab';
import { AuthModal } from '@/components/auth/AuthModal';
import { UploadPage } from '@/components/upload/UploadPage';
import { CommunityPage } from '@/components/community/CommunityPage';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { WishlistPage } from '@/components/wishlist/WishlistPage';
import { ChatModal } from '@/components/chat/ChatModal';
import { useAuth } from '@/hooks/useAuth';
import { Upload, User, Users, LogIn, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type NavItem = 'shelf' | 'wishlist' | 'upload' | 'community' | 'profile';

const Index = () => {
  const [activeTab, setActiveTab] = useState<NavItem>('shelf');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatInitialUserId, setChatInitialUserId] = useState<string | null>(null);
  const [chatInitialBookId, setChatInitialBookId] = useState<string | null>(null);
  const { user, loading, signOut } = useAuth();

  const handleOpenChat = (userId: string, bookId: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setChatInitialUserId(userId);
    setChatInitialBookId(bookId);
    setShowChatModal(true);
  };

  const handleCloseChat = () => {
    setShowChatModal(false);
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
        if (!user) {
          return (
            <PlaceholderTab
              icon={Upload}
              title="Sign In Required"
              description="Please sign in to upload books and share with the community."
            />
          );
        }
        return <UploadPage />;
      case 'community':
        if (!user) {
          return (
            <PlaceholderTab
              icon={Users}
              title="Sign In Required"
              description="Please sign in to join and create communities."
            />
          );
        }
        return <CommunityPage />;
      case 'profile':
        if (!user) {
          return (
            <PlaceholderTab
              icon={User}
              title="Sign In Required"
              description="Please sign in to access your profile settings."
            />
          );
        }
        return <ProfilePage onSignOut={signOut} />;
      default:
        return <Bookshelf onOpenChat={handleOpenChat} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Auth */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            Moa 📚
          </h1>
          
          <div className="flex items-center gap-2">
            {user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowChatModal(true)}
                className="relative"
              >
                <MessageCircle className="w-5 h-5" />
              </Button>
            )}
            
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : !user && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowAuthModal(true)}
                className="gap-2"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Button>
            )}
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

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* Chat Modal */}
      <ChatModal 
        isOpen={showChatModal} 
        onClose={handleCloseChat}
        initialUserId={chatInitialUserId}
        initialBookId={chatInitialBookId}
      />
    </div>
  );
};

export default Index;
