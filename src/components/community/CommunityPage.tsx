import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users } from 'lucide-react';
import { CommunityList } from './CommunityList';
import { CreateCommunityForm } from './CreateCommunityForm';
import { JoinCommunityForm } from './JoinCommunityForm';

type View = 'list' | 'create' | 'join';

interface Community {
  id: string;
  name: string;
  member_count: number | null;
}

export const CommunityPage = () => {
  const [view, setView] = useState<View>('list');
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);

  const handleSelectCommunity = (community: Community) => {
    setSelectedCommunity(community);
    setView('join');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedCommunity(null);
  };

  return (
    <div className="h-full px-4 py-6 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
          <Users className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Communities</h1>
        <p className="text-muted-foreground mt-1">
          Join private groups to share books
        </p>
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {view === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CommunityList
              onSelectCommunity={handleSelectCommunity}
              onCreateNew={() => setView('create')}
            />
          </motion.div>
        )}

        {view === 'create' && (
          <motion.div
            key="create"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CreateCommunityForm
              onSuccess={handleBackToList}
              onCancel={handleBackToList}
            />
          </motion.div>
        )}

        {view === 'join' && selectedCommunity && (
          <motion.div
            key="join"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <JoinCommunityForm
              community={selectedCommunity}
              onSuccess={handleBackToList}
              onBack={handleBackToList}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
