import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, User, Book, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTransactions, useTransactionHistory, Transaction } from '@/hooks/useTransactions';
import { TransactionEditModal } from './TransactionEditModal';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TransactionDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  /** When provided, only show transactions between the current user and this partner */
  partnerId?: string;
  /** 열 때 보여줄 탭 (기본: 진행중) */
  initialTab?: 'active' | 'history';
}

export const TransactionDashboard = ({ isOpen, onClose, partnerId, initialTab }: TransactionDashboardProps) => {
  const { transactions: allTransactions, loading, updateTransaction, refresh } = useTransactions();
  const { history: allHistory, loading: historyLoading, refresh: refreshHistory } = useTransactionHistory();

  // 이 훅 인스턴스는 부모(책장/채팅)가 마운트될 때 한 번 가져온 뒤 갱신되지 않는다.
  // 그래서 그 사이 새로 생긴 거래가 안 보였다. 열 때마다 최신으로 다시 불러온다.
  const [tab, setTab] = useState<'active' | 'history'>(initialTab ?? 'active');

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab ?? 'active'); // 열 때마다 지정 탭으로(거래완료 클릭=히스토리)
      refresh();
      refreshHistory();
    }
  }, [isOpen, initialTab, refresh, refreshHistory]);

  const transactions = partnerId
    ? allTransactions.filter(t => t.counterparty?.id === partnerId)
    : allTransactions;

  const history = partnerId
    ? allHistory.filter(t => t.counterparty?.id === partnerId)
    : allHistory;
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  if (!isOpen) return null;

  const getStatusLabel = (transaction: Transaction) => {
    // 판매·나눔은 수락 즉시 완료 → 나눔/판매 구분해 '완료' 표기
    if (transaction.type === 'purchase') {
      return transaction.book?.mode === 'give' ? '나눔완료' : '판매완료';
    }
    // 대여: 완료(반납됨)면 '대여·반납 완료', 진행 중이면 방향 표기
    if (transaction.status === 'completed') {
      return '대여·반납 완료';
    }
    return transaction.isMine ? '대여해줌' : '대여받음';
  };

  const getStatusColor = (transaction: Transaction) => {
    if (transaction.type === 'purchase') {
      return 'bg-accent text-accent-foreground';
    }
    if (transaction.isMine) {
      return 'bg-primary text-primary-foreground';
    }
    return 'bg-secondary text-secondary-foreground';
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '미정';
    return format(new Date(date), 'yyyy.MM.dd', { locale: ko });
  };

  /**
   * 반납일 한 줄에 무엇을 쓸지.
   *
   * 두 날짜는 뜻이 다르다 — `return_date` 는 **약속한 예정일**, `returned_at` 은
   * **실제로 돌려받은 날**이다. 그래서 하나로 합치지 않고 상황에 따라 고른다.
   *  · 아직 대여 중  → 예정일을 보여줘야 "언제까지"가 보인다
   *  · 반납이 끝났으면 → 실제 반납일이 사실이다. 예정일밖에 없으면 그걸 쓴다
   *    (예정일도 없던 옛 거래는 마이그레이션이 채팅의 '반납 완료' 시각으로 채웠다)
   */
  const returnLine = (t: { status: string; return_date: string | null; returned_at?: string | null }) =>
    t.status === 'completed'
      ? { label: '반납일', value: formatDate(t.returned_at ?? t.return_date) }
      : { label: '반납 예정', value: formatDate(t.return_date) };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-[calc(100%-2rem)] max-w-lg box-border"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-card rounded-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl">
          {/* Header */}
          <header className="flex items-end justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
            <div>
              <p className="eyebrow">Lending & Borrowing</p>
              <h2 className="font-display text-[22px] font-medium tracking-tight text-foreground mt-0.5">거래 현황</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </header>

          {/* Tabs */}
          <div className="flex border-b border-border shrink-0">
            {(['active', 'history'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'active' ? '진행 중' : '히스토리'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {(tab === 'active' ? loading : historyLoading) ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (tab === 'active' ? transactions : history).length === 0 ? (
              <div className="text-center py-8">
                <Book className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {tab === 'active' ? '진행 중인 거래가 없습니다' : '거래 기록이 없습니다'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(tab === 'active' ? transactions : history).map((transaction) => (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-muted/50 rounded-xl p-4"
                  >
                    {/* Book Info */}
                    <div className="flex gap-3 mb-3">
                      {transaction.book?.cover_url ? (
                        <img
                          src={transaction.book.cover_url}
                          alt={transaction.book.title}
                          className="w-12 h-16 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-muted rounded-lg flex items-center justify-center">
                          <Book className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {transaction.book?.title || '제목 없음'}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {transaction.book?.author || '저자 미상'}
                        </p>
                      </div>
                    </div>

                    {/* Transaction Details */}
                    <div className="flex items-center justify-between text-sm mb-3">
                      {/* 상대가 이 거래에서 어느 쪽인지 이름 앞에 밝힌다.
                          히스토리는 빌려준 기록과 빌린 기록이 한 줄로 섞여 있는데,
                          배지는 전부 '대여·반납 완료'라 방향을 알 길이 없었다.
                          isMine = 내가 책 주인 → 상대는 빌려간 '거래자'. 아니면 상대가 '책주인'. */}
                      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                        <User className="w-4 h-4 shrink-0" />
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-background border border-border text-foreground/70 shrink-0">
                          {transaction.isMine ? '거래자' : '책주인'}
                        </span>
                        <span className="truncate">{transaction.counterparty?.nickname || '알 수 없음'}</span>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction)}`}>
                        {getStatusLabel(transaction)}
                      </span>
                    </div>

                     {/* 대여일 · 반납일 — 언제 빌려가서 언제 돌아왔는지가 기록의 핵심이다 */}
                     <div className="flex items-center justify-between text-sm gap-2">
                       <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                         <Calendar className="w-4 h-4 shrink-0" />
                         <span className="truncate">
                           대여일: {formatDate(transaction.start_date)}
                           <span className="mx-1.5 text-muted-foreground/50">·</span>
                           {returnLine(transaction).label}: {returnLine(transaction).value}
                         </span>
                       </div>
                       {tab === 'active' && transaction.isMine && transaction.type === 'rent' && (
                         <Button
                           variant="ghost"
                           size="sm"
                           className="text-primary h-8"
                           onClick={() => setEditingTransaction(transaction)}
                         >
                           수정
                         </Button>
                       )}
                     </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
        </motion.div>
      </motion.div>

      {/* Edit Modal */}
      <TransactionEditModal
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={async (id, updates) => {
          await updateTransaction(id, updates);
          setEditingTransaction(null);
        }}
      />
    </AnimatePresence>
  );
};
