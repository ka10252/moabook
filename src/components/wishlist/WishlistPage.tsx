import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { AddWishlistForm } from './AddWishlistForm';
import { WishlistCard } from './WishlistCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChatModal } from '@/components/chat/ChatModal';
import { toast } from 'sonner';

export const WishlistPage = () => {
  const { user } = useAuth();
  const { items, myItems, loading, addItem, removeItem, markFulfilled } = useWishlist();
  const { startConversation, sendMessage, refresh: refreshChat } = useChat();
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUserId, setChatUserId] = useState<string | null>(null);

  const filteredItems = items.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.author?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const othersItems = filteredItems.filter(item => item.user_id !== user?.id);

  const handleMessage = async (userId: string, bookTitle: string) => {
    if (!user) return;
    
    // Start conversation first
    const { conversation, error } = await startConversation(userId);
    if (error || !conversation) {
      toast.error('채팅을 시작할 수 없습니다');
      return;
    }

    if (conversation) {
      // Send initial context message about the wishlist item
      const contextMessage = `안녕하세요! 위시리스트에 있는 "${bookTitle}" 책에 대해 문의드립니다.`;
      await sendMessage(conversation.id, contextMessage);
      
      // Refresh to update list then open chat with the user
      await refreshChat();
      setChatUserId(userId);
      setChatOpen(true);
    }
  };

  const handleCloseChat = () => {
    setChatOpen(false);
    setChatUserId(null);
  };

  const handleResetChatValues = () => {
    setChatUserId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 py-4 bg-card/80 backdrop-blur-sm sticky top-0 z-30 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">위시리스트</h1>
          {user && (
            <Button
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              책 추가
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="위시리스트 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted border-0"
          />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Add Form */}
        <AnimatePresence>
          {showAddForm && user && (
            <AddWishlistForm
              onAdd={addItem}
              onCancel={() => setShowAddForm(false)}
            />
          )}
        </AnimatePresence>

        {/* Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full grid grid-cols-2 bg-muted">
            <TabsTrigger value="all">모든 위시리스트</TabsTrigger>
            <TabsTrigger value="mine" disabled={!user}>
              내 위시리스트 {user && myItems.length > 0 && `(${myItems.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4 space-y-3">
            {othersItems.length === 0 && myItems.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* My items first */}
                {myItems.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">내 요청</p>
                    {myItems.map(item => (
                      <WishlistCard
                        key={item.id}
                        item={item}
                        isOwner={true}
                        onDelete={() => removeItem(item.id)}
                        onMarkFulfilled={() => markFulfilled(item.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Others' items */}
                {othersItems.length > 0 && (
                  <div className="space-y-3">
                    {myItems.length > 0 && (
                      <p className="text-sm font-medium text-muted-foreground pt-2">커뮤니티 요청</p>
                    )}
                    {othersItems.map(item => (
                      <WishlistCard
                        key={item.id}
                        item={item}
                        isOwner={false}
                        onMessage={() => handleMessage(item.user_id, item.title)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="mine" className="mt-4 space-y-3">
            {myItems.length === 0 ? (
              <div className="text-center py-12">
                <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">아직 추가한 책이 없습니다</p>
                <Button
                  variant="link"
                  onClick={() => setShowAddForm(true)}
                  className="mt-2"
                >
                  첫 번째 책 추가하기
                </Button>
              </div>
            ) : (
              myItems.map(item => (
                <WishlistCard
                  key={item.id}
                  item={item}
                  isOwner={true}
                  onDelete={() => removeItem(item.id)}
                  onMarkFulfilled={() => markFulfilled(item.id)}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Chat Modal */}
      <ChatModal
        isOpen={chatOpen}
        onClose={handleCloseChat}
        initialUserId={chatUserId}
        onResetInitialValues={handleResetChatValues}
      />
    </div>
  );
};

const EmptyState = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="text-center py-12"
  >
    <Heart className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
    <h3 className="text-lg font-semibold text-foreground mb-2">아직 위시리스트가 없습니다</h3>
    <p className="text-muted-foreground text-sm max-w-xs mx-auto">
      찾고 있는 책을 추가해보세요! 커뮤니티에서 찾을 수 있을지도 몰라요.
    </p>
  </motion.div>
);
