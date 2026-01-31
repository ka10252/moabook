import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Book as BookIcon, Calendar, CheckCircle2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RentalConfirmationCardProps {
  type: 'accepted' | 'returned';
  transactionType?: 'rent' | 'purchase';
  book: {
    title: string;
    author: string;
    cover_url?: string | null;
  };
  startDate?: string | null;
  returnDate?: string | null;
  isOwner?: boolean;
  onReturnClick?: () => void;
  showReturnButton?: boolean;
}

export const RentalConfirmationCard = ({
  type,
  transactionType = 'rent',
  book,
  startDate,
  returnDate,
  isOwner = false,
  onReturnClick,
  showReturnButton = false,
}: RentalConfirmationCardProps) => {
  const isAccepted = type === 'accepted';
  const isPurchase = transactionType === 'purchase';
  
  // Determine header text
  const getHeaderText = () => {
    if (type === 'returned') return '반납이 완료되었습니다';
    if (isPurchase) return '판매가 완료되었습니다';
    return '대여가 수락되었습니다';
  };

  // Determine date label
  const getDateLabel = () => {
    if (isPurchase) return '거래일';
    return '대여일';
  };
  
  return (
    <div className={`rounded-xl overflow-hidden ${isAccepted ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' : 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'}`}>
      {/* Header */}
      <div className={`px-3 py-2 ${isAccepted ? 'bg-green-100 dark:bg-green-900/50' : 'bg-blue-100 dark:bg-blue-900/50'}`}>
        <div className="flex items-center gap-2">
          {isPurchase ? (
            <ShoppingBag className="w-4 h-4 text-green-600" />
          ) : (
            <CheckCircle2 className={`w-4 h-4 ${isAccepted ? 'text-green-600' : 'text-blue-600'}`} />
          )}
          <span className={`text-sm font-medium ${isAccepted ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300'}`}>
            {getHeaderText()}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Book Info */}
        <div className="flex gap-2">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              className="w-10 h-14 object-cover rounded flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-14 bg-muted rounded flex items-center justify-center flex-shrink-0">
              <BookIcon className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground line-clamp-1">{book.title}</p>
            <p className="text-xs text-muted-foreground">{book.author}</p>
          </div>
        </div>
        
        {/* Dates */}
        <div className="flex flex-col gap-1 text-xs">
          {startDate && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>{getDateLabel()}: {format(new Date(startDate), 'yyyy년 M월 d일', { locale: ko })}</span>
            </div>
          )}
          {/* Only show return date for rentals */}
          {!isPurchase && returnDate && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>{isAccepted ? '반납 예정일' : '반납일'}: {format(new Date(returnDate), 'yyyy년 M월 d일', { locale: ko })}</span>
            </div>
          )}
          {!isPurchase && isAccepted && !returnDate && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>반납 예정일: 미정</span>
            </div>
          )}
        </div>
        
        {/* Return Button (only for owner on accepted rental cards, NOT for purchases) */}
        {!isPurchase && showReturnButton && isOwner && isAccepted && onReturnClick && (
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2 rounded-xl border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/50"
            onClick={onReturnClick}
          >
            반납 완료
          </Button>
        )}
      </div>
    </div>
  );
};
