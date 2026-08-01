import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Book as BookIcon, Calendar, CheckCircle2, Clock, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

export type RentalMessageType = 'request' | 'accepted' | 'returned' | 'return_request';
export type TransactionType = 'rent' | 'purchase';

interface RentalMessageCardProps {
  type: RentalMessageType;
  transactionType?: TransactionType;
  /** 유저에게 보이는 실제 모드 — 나눔·판매를 구분해 문구를 다르게 낸다 */
  mode?: 'rent' | 'sell' | 'give';
  book: {
    title: string;
    author: string;
    cover_url?: string | null;
  };
  startDate?: string | null;
  returnDate?: string | null;
  // For request cards
  showAcceptButton?: boolean;
  onAcceptClick?: () => void;
  hasActiveTransaction?: boolean;
  // For accepted cards (owner side) — 반납 확인은 책 주인만. 대여자에겐 반납 버튼을 두지 않는다
  // (실물은 만나서 주고받으므로 주인이 확인하는 게 사실의 원천).
  showReturnButton?: boolean;
  onReturnClick?: () => void;
  // For return_request cards (owner side) — 레거시: 예전 대여자 '반납 요청' 메시지 처리용
  showAcceptReturnButton?: boolean;
  onAcceptReturnClick?: () => void;
}

export const RentalMessageCard = ({
  type,
  transactionType = 'rent',
  mode,
  book,
  startDate,
  returnDate,
  showAcceptButton = false,
  onAcceptClick,
  hasActiveTransaction = false,
  showReturnButton = false,
  onReturnClick,
  showAcceptReturnButton = false,
  onAcceptReturnClick,
}: RentalMessageCardProps) => {
  const isPurchase = transactionType === 'purchase';
  // mode가 있으면 그걸 우선한다 (나눔·판매 구분). 없으면 기존 transactionType로 폴백.
  const isGive = mode === 'give';

  // Header configuration based on type
  const getHeaderConfig = () => {
    switch (type) {
      case 'request':
        return {
          text: isGive ? '나눔을 요청합니다' : isPurchase ? '구매를 요청합니다' : '대여를 요청합니다',
          icon: Clock,
          bgColor: 'bg-amber-100 dark:bg-amber-900/50',
          textColor: 'text-amber-700 dark:text-amber-300',
          iconColor: 'text-amber-600',
          cardBg: 'bg-amber-50 dark:bg-amber-950/30',
          borderColor: 'border-amber-200 dark:border-amber-800',
        };
      case 'accepted':
        return {
          text: isGive ? '나눔이 완료되었습니다' : isPurchase ? '판매가 완료되었습니다' : '대여가 수락되었습니다',
          icon: CheckCircle2,
          bgColor: 'bg-green-100 dark:bg-green-900/50',
          textColor: 'text-green-700 dark:text-green-300',
          iconColor: 'text-green-600',
          cardBg: 'bg-green-50 dark:bg-green-950/30',
          borderColor: 'border-green-200 dark:border-green-800',
        };
      case 'returned':
        return {
          text: '반납이 완료되었습니다',
          icon: PackageCheck,
          bgColor: 'bg-blue-100 dark:bg-blue-900/50',
          textColor: 'text-blue-700 dark:text-blue-300',
          iconColor: 'text-blue-600',
          cardBg: 'bg-blue-50 dark:bg-blue-950/30',
          borderColor: 'border-blue-200 dark:border-blue-800',
        };
      case 'return_request':
        return {
          text: '책을 반납했어요',
          icon: PackageCheck,
          bgColor: 'bg-orange-100 dark:bg-orange-900/50',
          textColor: 'text-orange-700 dark:text-orange-300',
          iconColor: 'text-orange-600',
          cardBg: 'bg-orange-50 dark:bg-orange-950/30',
          borderColor: 'border-orange-200 dark:border-orange-800',
        };
    }
  };

  const config = getHeaderConfig();
  const Icon = config.icon;

  return (
    <Card className={`overflow-hidden ${config.cardBg} ${config.borderColor} border shadow-sm`}>
      {/* Header */}
      <CardHeader className={`px-3 py-2 ${config.bgColor}`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${config.iconColor}`} />
          <span className={`text-sm font-medium ${config.textColor}`}>
            {config.text}
          </span>
        </div>
      </CardHeader>
      
      {/* Content */}
      <CardContent className="p-3 space-y-3">
        {/* Book Info */}
        <div className="flex gap-3">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              className="w-12 h-16 object-cover rounded-lg flex-shrink-0 shadow-sm"
            />
          ) : (
            <div className="w-12 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
              <BookIcon className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm line-clamp-2">{book.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{book.author}</p>
          </div>
        </div>
        
        {/* Dates (only for accepted state) */}
        {type === 'accepted' && (
          <div className="flex flex-col gap-1.5 pt-1 border-t border-border/50">
            {startDate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>{isPurchase ? '거래일' : '대여일'}: {format(new Date(startDate), 'yyyy년 M월 d일', { locale: ko })}</span>
              </div>
            )}
            {!isPurchase && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>반납 예정일: {returnDate ? format(new Date(returnDate), 'yyyy년 M월 d일', { locale: ko }) : '미정'}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      {/* Footer - Action Buttons */}
      <CardFooter className="p-3 pt-0 flex flex-col gap-1">
        {/* Request: Accept Button (for owner only) */}
        {type === 'request' && showAcceptButton && !hasActiveTransaction && (
          <Button
            size="sm"
            className="w-full rounded-xl"
            onClick={onAcceptClick}
          >
            {isGive ? '나눔 수락' : isPurchase ? '판매 수락' : '대여 수락'}
          </Button>
        )}
        
        {/* Request: Already has active transaction */}
        {type === 'request' && hasActiveTransaction && (
          <div className="w-full text-center text-xs text-muted-foreground py-2 bg-muted/50 rounded-lg">
            이미 진행 중인 거래가 있습니다
          </div>
        )}
        
        {/* Accepted: Owner confirms return (책 주인만) */}
        {type === 'accepted' && !isPurchase && showReturnButton && onReturnClick && (
          <div className="w-full flex flex-col items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-xl border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/50"
              onClick={onReturnClick}
            >
              반납 확인
            </Button>
            <span className="text-[12px] text-muted-foreground">
              반납받았으면 눌러주세요
            </span>
          </div>
        )}

        {/* Return request: Owner accepts the return */}
        {type === 'return_request' && showAcceptReturnButton && onAcceptReturnClick && (
          <div className="w-full flex flex-col items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-xl border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/50"
              onClick={onAcceptReturnClick}
            >
              반납 확인
            </Button>
            <span className="text-[12px] text-muted-foreground">
              반납받았으면 눌러주세요
            </span>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};
