import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookshelf } from '@/components/Bookshelf';
import { BottomNav } from '@/components/BottomNav';
import { PlaceholderTab } from '@/components/PlaceholderTab';
import { Heart, Upload, Library, User } from 'lucide-react';

type NavItem = 'shelf' | 'wishlist' | 'upload' | 'library' | 'profile';

const Index = () => {
  const [activeTab, setActiveTab] = useState<NavItem>('shelf');

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
        return (
          <PlaceholderTab
            icon={Upload}
            title="Upload a Book"
            description="Share your books with fellow exchange students. Search by title to auto-fill details."
          />
        );
      case 'library':
        return (
          <PlaceholderTab
            icon={Library}
            title="My Library"
            description="Your uploaded books and borrowed items will be organized here."
          />
        );
      case 'profile':
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
      {/* Main Content Area */}
      <main className="flex-1 pb-20 overflow-hidden">
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
    </div>
  );
};

export default Index;
