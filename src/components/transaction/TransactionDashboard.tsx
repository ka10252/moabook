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
}

export const TransactionDashboard = ({ isOpen, onClose, partnerId }: TransactionDashboardProps) => {
  const { transactions: allTransactions, loading, updateTransaction, refresh } = useTransactions();
  const { history: allHistory, loading: historyLoading, refresh: refreshHistory } = useTransactionHistory();

  // 이 훅 인스턴스는 부모(책장/채팅)가 마운트될 때 한 번 가져온 뒤 갱신되지 않는다.
  // 그래서 그 사이 새로 생긴 거래가 안 보였다. 열 때마다 최신으로 다시 불러온다.
  useEffect(() => {
    if (isOpen) {
      refresh();
      refreshHistory();
    }
  }, [isOpen, refresh, refreshHistory]);

  const transactions = partnerId
    ? allTransactions.filter(t => t.counterparty?.id === partnerId)
    : allTransactions;

  const history = partnerId
    ? allHistory.filter(t => t.counterparty?.id === partnerId)
    : allHistory;
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [tab, setTab] = useState<'active' | 'history'>('active');

  if (!isOpen) return null;

  const getStatusLabel = (transaction: Transaction) => {
    if (transaction.type === 'purchase') {
      return '판매완료';
    }
    if (transaction.isMine) {
      return '대여해줌';
    }
    return '대여받음';
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

  const formatReturnDate = (date: string | null) => {
    if (!date) return '미정';
    return format(new Date(date), 'yyyy.MM.dd', { locale: ko });
  };

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
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>{transaction.counterparty?.nickname || '알 수 없음'}</span>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction)}`}>
                        {getStatusLabel(transaction)}
                      </span>
                    </div>

                     {/* Date & Return Date */}
                     <div className="flex items-center justify-between text-sm">
                       <div className="flex items-center gap-2 text-muted-foreground">
                         <Calendar className="w-4 h-4" />
                         <span>반납일: {formatReturnDate(transaction.return_date)}</span>
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
