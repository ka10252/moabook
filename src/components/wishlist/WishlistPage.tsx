import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Heart, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useWishlist, type WishlistItem } from '@/hooks/useWishlist';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useGuestGate } from '@/hooks/useGuestGate';
import { AddWishlistForm } from './AddWishlistForm';
import { WishlistCard } from './WishlistCard';
import { ChatModal } from '@/components/chat/ChatModal';
import { toast } from 'sonner';

type Filter = 'all' | 'mine';

/**
 * 실제 요청이 아직 적을 때만 채워 넣는 예시 카드 (서가의 예시 책과 같은 방식).
 * 한마디가 왜 중요한 정보인지 — 왜 찾는지, 어떤 판본을 원하는지 — 를 보여주는 게 목적이다.
 * 요청이 3건 이상 쌓이면 사라진다.
 */
const DEMO_THRESHOLD = 3;
const DEMO_ITEMS: WishlistItem[] = [
  {
    id: 'demo-w1',
    user_id: 'demo',
    title: '불편한 편의점',
    author: '김호연',
    notes: '한국 다녀오신 분 계시면 빌려보고 싶어요! 클레멘티 근처면 제가 찾아갈게요 🙂',
    is_fulfilled: false,
    created_at: '',
    profile: { nickname: '지현' },
  },
  {
    id: 'demo-w2',
    user_id: 'demo',
    title: '아몬드',
    author: '손원평',
    notes: '아이가 학교 독후감 숙제로 필요해서 2주만 빌릴 수 있을까요? 상태는 상관없습니다.',
    is_fulfilled: false,
    created_at: '',
    profile: { nickname: '민서' },
  },
  {
    id: 'demo-w3',
    user_id: 'demo',
    title: '사피엔스',
    author: '유발 하라리',
    notes: '개정판이면 더 좋고, 구매도 괜찮아요. 조건 알려주시면 감사하겠습니다.',
    is_fulfilled: false,
    created_at: '',
    profile: { nickname: '태윤' },
  },
];

export const WishlistPage = () => {
  const { user } = useAuth();
  const { requireAuth } = useGuestGate();
  const { items, myItems, loading, addItem, removeItem, markFulfilled } = useWishlist();
  const { startConversation, sendMessage, refresh: refreshChat } = useChat();
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUserId, setChatUserId] = useState<string | null>(null);

  const matches = (title: string, author?: string | null) =>
    title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (author || '').toLowerCase().includes(searchQuery.toLowerCase());

  const filteredItems = items.filter((item) => matches(item.title, item.author));
  const mine = filteredItems.filter((item) => item.user_id === user?.id);
  const others = filteredItems.filter((item) => item.user_id !== user?.id);

  const handleMessage = async (userId: string, bookTitle: string) => {
    if (!requireAuth()) return;

    const { conversation, error } = await startConversation(userId);
    if (error || !conversation) {
      toast.error('채팅을 시작할 수 없습니다');
      return;
    }

    const contextMessage = `안녕하세요! 위시리스트에 있는 "${bookTitle}" 책에 대해 문의드립니다.`;
    await sendMessage(conversation.id, contextMessage);
    await refreshChat();
    setChatUserId(userId);
    setChatOpen(true);
  };

  const handleAddClick = () => {
    if (!requireAuth()) return;
    setShowAddForm((v) => !v);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const showMineSection = filter === 'all' || filter === 'mine';
  const showOthersSection = filter === 'all';

  // 실제 요청이 적을 때만 예시로 채운다. 검색 중이거나 요청이 쌓이면 사라진다.
  const demoItems =
    showOthersSection && !searchQuery.trim() && items.length < DEMO_THRESHOLD
      ? DEMO_ITEMS.slice(0, DEMO_THRESHOLD - items.length)
      : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-5 pt-5 pb-3 bg-background/85 backdrop-blur-md sticky top-0 z-30 space-y-3.5">
        <div className="flex items-end justify-between gap-2">
          <div className="shrink-0">
            <p className="eyebrow">WISHLIST</p>
            <h1 className="font-display text-[30px] font-medium leading-none tracking-tight text-foreground mt-1">
              위시리스트
            </h1>
          </div>
          <button
            onClick={handleAddClick}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-[11px] font-bold px-3.5 py-2 rounded-full shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />책 추가
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-faint" />
          <Input
            placeholder="위시리스트 검색…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-9 text-xs bg-card border-border rounded-xl"
          />
        </div>

        {/* Filter chips — 한 줄, 활성은 코랄 */}
        <div className="flex gap-1.5">
          {([
            ['all', '모든 위시리스트'],
            ['mine', user ? `내 위시리스트 ${myItems.length}` : '내 위시리스트'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 text-[11px] font-bold py-2 rounded-[9px] transition-colors ${
                filter === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
        <AnimatePresence>
          {showAddForm && user && (
            <AddWishlistForm onAdd={addItem} onCancel={() => setShowAddForm(false)} />
          )}
        </AnimatePresence>

        {mine.length === 0 && others.length === 0 && demoItems.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {showMineSection && mine.length > 0 && (
              <section className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground px-0.5 pt-2">내 요청</p>
                {mine.map((item) => (
                  <WishlistCard
                    key={item.id}
                    item={item}
                    isOwner
                    onDelete={() => removeItem(item.id)}
                    onMarkFulfilled={() => markFulfilled(item.id)}
                  />
                ))}
              </section>
            )}

            {filter === 'mine' && mine.length === 0 && (
              <div className="text-center py-12">
                <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">아직 추가한 책이 없습니다</p>
                <button onClick={handleAddClick} className="mt-2 text-sm text-primary font-semibold">
                  첫 번째 책 추가하기
                </button>
              </div>
            )}

            {showOthersSection && (others.length > 0 || demoItems.length > 0) && (
              <section className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground px-0.5 pt-2">
                  이웃의 요청
                </p>
                {others.map((item) => (
                  <WishlistCard
                    key={item.id}
                    item={item}
                    isOwner={false}
                    onMessage={() => handleMessage(item.user_id, item.title)}
                  />
                ))}
                {/* 예시 카드에도 답장 버튼은 그대로 둔다 —
                    "이 책 나한테 있는데요"라고 말을 거는 게 위시리스트의 핵심 동작이라
                    버튼이 빠지면 무엇을 하는 화면인지 알 수가 없다. */}
                {demoItems.map((item) => (
                  <WishlistCard
                    key={item.id}
                    item={item}
                    isOwner={false}
                    isDemo
                    onMessage={() => toast.info('예시 카드예요. 실제 이웃의 요청에서 답장할 수 있습니다.')}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>

      <ChatModal
        isOpen={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setChatUserId(null);
        }}
        initialUserId={chatUserId}
        onResetInitialValues={() => setChatUserId(null)}
      />
    </div>
  );
};

const EmptyState = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
    <Heart className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
    <h3 className="font-display text-xl font-medium text-foreground mb-2">아직 위시리스트가 없습니다</h3>
    <p className="text-muted-foreground text-sm max-w-xs mx-auto">
      찾고 있는 책을 추가해보세요! 커뮤니티에서 찾을 수 있을지도 몰라요.
    </p>
  </motion.div>
);
