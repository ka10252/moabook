import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookshelf } from '@/components/Bookshelf';
import { BottomNav } from '@/components/BottomNav';
import { PlaceholderTab } from '@/components/PlaceholderTab';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/hooks/useAuth';
import { Heart, Upload, Library, User, LogIn, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type NavItem = 'shelf' | 'wishlist' | 'upload' | 'library' | 'profile';

const Index = () => {
  const [activeTab, setActiveTab] = useState<NavItem>('shelf');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, loading, signOut } = useAuth();

  const renderContent = () => {
    switch (activeTab) {
      case 'shelf':
        return <Bookshelf />;
      case 'wishlist':
        return (
          <PlaceholderTab
            icon={Heart}
            title="Wishlist"
            description="Books you're looking for will appear here. Post what you need and let the community help!"
          />
        );
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
        return (
          <PlaceholderTab
            icon={Upload}
            title="Upload a Book"
            description="Share your books with fellow exchange students. Search by title to auto-fill details."
          />
        );
      case 'library':
        if (!user) {
          return (
            <PlaceholderTab
              icon={Library}
              title="Sign In Required"
              description="Please sign in to view your library and borrowed books."
            />
          );
        }
        return (
          <PlaceholderTab
            icon={Library}
            title="My Library"
            description="Your uploaded books and borrowed items will be organized here."
          />
        );
      case 'profile':
        if (!user) {
          return (
            <PlaceholderTab
              icon={User}
              title="Sign In Required"
              description="Please sign in to access your profile and chat with book owners."
            />
          );
        }
        return (
          <PlaceholderTab
            icon={User}
            title="Profile & Chat"
            description="Manage your communities, chat with book owners, and update your profile."
          />
        );
      default:
        return <Bookshelf />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Auth */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            Ex-Lib 📚
          </h1>
          
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : user ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          ) : (
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
    </div>
  );
};

export default Index;
