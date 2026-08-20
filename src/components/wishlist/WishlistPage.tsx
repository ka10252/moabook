import { Fragment, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Loader2 } from 'lucide-react';
import { useWishlist, type WishlistItem } from '@/hooks/useWishlist';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useBooks } from '@/hooks/useBooks';
import { supabase } from '@/integrations/supabase/client';
import { useGuestGate } from '@/hooks/useGuestGate';
import { AddWishlistForm } from './AddWishlistForm';
import { WishlistCard } from './WishlistCard';
import { ChatModal } from '@/components/chat/ChatModal';
import { spineClassFrom } from '@/lib/spineColor';
import { toast } from 'sonner';
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

type OfferMode = 'rent' | 'give' | 'sell';
const OFFER_OPTIONS: { id: OfferMode; label: string }[] = [
  { id: 'rent', label: '빌려줄게요' },
  { id: 'give', label: '나눠줄게요' },
  { id: 'sell', label: '팔게요' },
];

/** 카드에 보일 책 한 줄(제목 · 저자) */
const offerBookLine = (item: WishlistItem) =>
  `${item.title}${item.author ? ` · ${item.author}` : ''}`;
/** 실제 전송 메시지 — [위시 보유:rent,give] ... [WISHCOVER:url] (모드 중복 가능) → ChatView 카드로 렌더 */
const offerMessage = (item: WishlistItem, modes: OfferMode[]) =>
  `[위시 보유:${modes.join(',')}] ${offerBookLine(item)}${item.cover_url ? ` [WISHCOVER:${item.cover_url}]` : ''}`;
const OFFER_LABEL: Record<OfferMode, string> = { rent: '대여', give: '나눔', sell: '판매' };

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
  const { items, myItems, loading, addItem, updateNotes, removeItem, markFulfilled } = useWishlist();
  const { startConversation, sendMessage, refresh: refreshChat } = useChat();
  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<'recommended' | 'newest'>('recommended');
  const { books: myBooks } = useBooks();
  const [myStation, setMyStation] = useState<string | null>(null);
  const [myDistrict, setMyDistrict] = useState<string | null>(null);
  useEffect(() => {
    if (!user) { setMyStation(null); setMyDistrict(null); return; }
    let alive = true;
    supabase
      .from('profiles')
      .select('mrt_station, district')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        const row = data as { mrt_station?: string | null; district?: string | null };
        setMyStation(row.mrt_station ?? null);
        setMyDistrict(row.district ?? null);
      });
    return () => { alive = false; };
  }, [user?.id]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  // '가지고 있어요' 확인 팝업 대상 — 클릭 즉시 보내지 않고, 발송 내용 미리보기 후 확인받는다(F6)
  const [msgTarget, setMsgTarget] = useState<WishlistItem | null>(null);
  const [offerModes, setOfferModes] = useState<OfferMode[]>(['rent']);
  const [sendingMsg, setSendingMsg] = useState(false);
  const toggleOfferMode = (m: OfferMode) =>
    setOfferModes((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  // 상단 검색창은 없앴다(F4) — 위시리스트에서 할 일은 '원하는 책 올리기' 하나다.

  /**
   * F5 · '모든 위시리스트' 정렬.
   *
   * 기본값을 최신순으로 두면 목록이 그냥 게시판이 된다. 여기서 유저가 할 수 있는 건
   * "내가 도와줄 수 있는 요청을 찾는 것" 하나뿐이라, 그 순서로 세운다.
   *   ① 내가 이미 가진 책 — 제목이 겹치면 바로 빌려줄 수 있다
   *   ② 나와 가까운 사람 — 같은 역이 같은 지역보다 가깝다
   *   ③ 최신
   *
   * 제목 매칭은 공백·대소문자만 지운 단순 비교다. 판형·부제까지 맞추려면 정규화가
   * 필요한데, 지금은 잘못 매칭돼도 "혹시 이 책 있나요?" 정도의 비용이라 이걸로 둔다.
   */
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, '');
  const myBookTitles = useMemo(
    () => new Set(myBooks.filter((b) => b.owner_id === user?.id).map((b) => norm(b.title))),
    [myBooks, user?.id],
  );

  /**
   * '모든 요청'에는 내 요청도 함께 담는다.
   *
   * 예전엔 남의 요청만 보여줬다. 그러면 내가 올린 것을 보려고 탭을 옮겨야 하는데,
   * 정작 목록에서 하는 일(누가 뭘 찾는지 훑기)은 주인이 누구든 똑같다.
   * 대신 **위로 고정하지 않는다** — 고정하면 정렬을 바꿔도 항상 같은 자리라
   * 정렬이 안 먹는 것처럼 보인다. 관련순·최신순 기준을 그대로 함께 받는다.
   */
  const others = useMemo(() => {
    const list = filter === 'mine' ? items.filter((item) => item.user_id === user?.id) : items;
    if (sort === 'newest') {
      return [...list].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }
    const score = (it: WishlistItem) => {
      // 내 요청은 내가 도와줄 대상이 아니므로 관련도 가산점에서 빠진다.
      // 빼는 게 아니라 0점 — 최신순 기준으로 자연스럽게 섞인다.
      if (it.user_id === user?.id) return 0;
      let s = 0;
      if (myBookTitles.has(norm(it.title))) s += 100;
      if (myStation && it.profile?.mrt_station === myStation) s += 20;
      else if (myDistrict && it.profile?.district === myDistrict) s += 10;
      return s;
    };
    return [...list].sort((a, b) => {
      const d = score(b) - score(a);
      if (d !== 0) return d;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [items, user?.id, sort, filter, myBookTitles, myStation, myDistrict]);

  const canOffer = (it: WishlistItem) => myBookTitles.has(norm(it.title));

  // 1단계: 버튼 클릭 → 확인 팝업만 연다(바로 발송하지 않음).
  // 요청자가 '사고 싶어요'면 기본을 판매로, 그 외엔 대여로 맞춰준다.
  const handleMessage = (item: WishlistItem) => {
    if (!requireAuth()) return;
    setOfferModes(item.desired_mode === 'buy' ? ['sell'] : ['rent']);
    setMsgTarget(item);
  };

  // 2단계: 확인 시 실제 발송 + 채팅 이동.
  const confirmSendOffer = async () => {
    if (!msgTarget) return;
    if (offerModes.length === 0) { toast.error('거래 방식을 하나 이상 선택해주세요'); return; }
    setSendingMsg(true);
    try {
      const { conversation, error } = await startConversation(msgTarget.user_id);
      if (error || !conversation) {
        toast.error('채팅을 시작할 수 없습니다');
        return;
      }
      await sendMessage(conversation.id, offerMessage(msgTarget, offerModes));
      await refreshChat();
      setChatUserId(msgTarget.user_id);
      setChatOpen(true);
      setMsgTarget(null);
    } finally {
      setSendingMsg(false);
    }
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

  // 목록은 하나다. 범위(모든/내 요청)는 정렬 줄에서 고르고, 그 결과가 곧 이 목록이다.
  // 실제 요청이 적을 때만 예시로 채운다. 요청이 쌓이면 사라진다.
  const demoItems =
    filter === 'all' && items.length < DEMO_THRESHOLD
      ? DEMO_ITEMS.slice(0, DEMO_THRESHOLD - items.length)
      : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-5 pt-5 pb-3 bg-background/85 backdrop-blur-md sticky sticky-under-header z-30">
        <div className="flex items-end justify-between gap-2">
          <div className="shrink-0">
            <p className="eyebrow">WISHLIST</p>
            <h1 className="font-display text-[30px] font-medium leading-none tracking-tight text-foreground mt-1">
              위시리스트
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
            </p>
          </div>
        </div>

      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
        <AnimatePresence>
          {showAddForm && user && (
            <AddWishlistForm onAdd={addItem} onCancel={() => setShowAddForm(false)} />
          )}
        </AnimatePresence>

        {items.length === 0 && demoItems.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <section className="space-y-2">
              {/* 범위 전환은 정렬 줄 왼쪽에 얹는다. 거의 안 바꾸는 선택이라
                  화면 폭을 채우는 탭 두 개를 쓸 이유가 없다. */}
              <div className="flex items-center justify-between gap-2 px-0.5 pt-2">
                <div className="flex items-center gap-1.5 shrink-0 text-[13px]">
                  {([
                    ['all', '모든 요청'],
                    ['mine', user ? `내 요청 ${myItems.length}` : '내 요청'],
                  ] as const).map(([key, label], i) => (
                    <Fragment key={key}>
                      {i > 0 && <span className="text-border">·</span>}
                      <button
                        onClick={() => setFilter(key)}
                        className={`tap-44 transition-colors ${
                          filter === key
                            ? 'text-foreground font-bold'
                            : 'text-faint hover:text-muted-foreground font-semibold'
                        }`}
                      >
                        {label}
                      </button>
                    </Fragment>
                  ))}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {([['recommended', '관련순'], ['newest', '최신순']] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSort(key)}
                      className={`tap-44 text-[13px] px-2 py-1 rounded-full transition-colors ${
                        sort === key
                          ? 'bg-[hsl(var(--primary-soft))] text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {filter === 'mine' && others.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">아직 추가한 책이 없습니다</p>
                  <button onClick={handleAddClick} className="mt-2 text-sm text-primary font-semibold">
                    첫 번째 책 추가하기
                  </button>
                </div>
              ) : (
                /* 말풍선 자체가 테두리를 가지므로 바깥 상자는 두지 않는다 — 이중 액자가 되면 지저분하다 */
                <div>
                {others.map((item) => (
                  item.user_id === user?.id ? (
                    <WishlistCard
                      key={item.id}
                      item={item}
                      isOwner
                      onDelete={async () => {
                        const { error } = await removeItem(item.id);
                        if (error) { toast.error('삭제에 실패했어요. 다시 시도해주세요.'); throw error; }
                      }}
                      onMarkFulfilled={async () => {
                        const { error } = await markFulfilled(item.id);
                        if (error) { toast.error('처리에 실패했어요. 다시 시도해주세요.'); throw error; }
                        toast.success('찾았어요! 목록에서 내렸어요');
                      }}
                      onEditNotes={async (notes) => {
                        const { error } = await updateNotes(item.id, notes);
                        if (error) toast.error('저장에 실패했어요. 다시 시도해주세요.');
                      }}
                    />
                  ) : (
                    <WishlistCard
                      key={item.id}
                      item={item}
                      isOwner={false}
                      canOffer={canOffer(item)}
                      onMessage={() => handleMessage(item)}
                    />
                  )
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
                    onMessage={() => { toast.info('예시 카드예요. 실제 이웃의 요청에서 답장할 수 있습니다.'); }}
                  />
                ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* '가지고 있어요' 확인 — 발송 내용을 미리 보여준 뒤 동의를 받고 보낸다(모르는 사이 전송 방지) */}
      <AlertDialog open={!!msgTarget} onOpenChange={(o) => { if (!o) setMsgTarget(null); }}>
        <AlertDialogContent className="rounded-2xl max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {msgTarget?.profile?.nickname || '이웃'}님에게 알릴까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              어떻게 줄 수 있는지 고르면, 아래 카드가 전송돼요. 확인 후 채팅에서 자유롭게 이야기할 수 있어요.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* 거래방식 선택 — 중복 가능 */}
          <div className="flex gap-2">
            {OFFER_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => toggleOfferMode(o.id)}
                className={`flex-1 h-9 rounded-lg text-[13px] font-medium border transition-colors ${
                  offerModes.includes(o.id) ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* 전송될 카드 미리보기 (표지 있으면 표지, 없으면 placeholder) */}
          {msgTarget && (
            <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] px-3.5 py-3">
              <p className="text-[13px] font-bold text-primary mb-2">📚 위시 책을 가지고 있어요</p>
              <div className="flex gap-2.5">
                {msgTarget.cover_url ? (
                  <img src={msgTarget.cover_url} alt="" className="w-11 h-16 object-cover rounded shrink-0 bg-muted" />
                ) : (
                  <div className={`w-11 h-16 rounded shrink-0 ${spineClassFrom(msgTarget.title)}`} />
                )}
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-foreground leading-snug break-words">{offerBookLine(msgTarget)}</p>
                  <p className="text-[13px] text-primary font-semibold mt-1">
                    {offerModes.length ? `${offerModes.map((m) => OFFER_LABEL[m]).join(' · ')} 가능해요` : '거래방식을 골라주세요'}
                  </p>
                </div>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={sendingMsg}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmSendOffer(); }}
              disabled={sendingMsg || offerModes.length === 0}
              className="rounded-xl"
            >
              {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : '메시지 보내기'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ChatModal
        isOpen={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setChatUserId(null);
        }}
        initialUserId={chatUserId}
        onResetInitialValues={() => setChatUserId(null)}
      />

      {/* 책 추가 — 서가의 관심도서 버튼과 같은 자리·같은 모양.
          위에 가로로 길게 두니 목록보다 버튼이 먼저 눈에 들어왔다.
          할 일은 하나뿐이라 화면 구석에 두고 목록에 자리를 내준다. */}
      <motion.button
        onClick={handleAddClick}
        whileTap={{ scale: 0.94 }}
        aria-label={showAddForm ? '닫기' : '책 추가'}
        className="fixed bottom-[4.5rem] right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
      >
        <Plus className={`w-6 h-6 transition-transform duration-200 ${showAddForm ? 'rotate-45' : ''}`} />
      </motion.button>
    </div>
  );
};

const EmptyState = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
    <Search className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
    <h3 className="font-display text-xl font-medium text-foreground mb-2">아직 위시리스트가 없습니다</h3>
    <p className="text-muted-foreground text-sm max-w-xs mx-auto">
      찾고 있는 책을 추가해보세요! 커뮤니티에서 찾을 수 있을지도 몰라요.
    </p>
  </motion.div>
);
