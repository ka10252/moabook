import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, LogOut, Settings } from 'lucide-react';
import { CommunityList } from './CommunityList';
import { CreateCommunityForm } from './CreateCommunityForm';
import { JoinCommunityForm } from './JoinCommunityForm';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type View = 'list' | 'create' | 'join';

interface Community {
  id: string;
  name: string;
  member_count: number | null;
}

interface CommunityPageProps {
  onSignOut?: () => void;
}

export const CommunityPage = ({ onSignOut }: CommunityPageProps) => {
  const [view, setView] = useState<View>('list');
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  const handleSelectCommunity = (community: Community) => {
    setSelectedCommunity(community);
    setView('join');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedCommunity(null);
  };

  const handleSignOut = () => {
    setShowSignOutDialog(false);
    onSignOut?.();
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

      {/* Settings Section */}
      {onSignOut && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed bottom-24 left-0 right-0 px-4"
        >
          <div className="max-w-md mx-auto">
            <div className="glass-card p-4 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <Settings className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Settings</span>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowSignOutDialog(true)}
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Sign Out Confirmation */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need to sign in again to access your books and communities.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
