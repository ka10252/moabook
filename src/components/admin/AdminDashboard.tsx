import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users, BookOpen, Building2, ArrowLeftRight,
  UserPlus, RefreshCw, Loader2, AlertCircle, CheckCircle2, Clock
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';

interface DashboardStats {
  totalUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  totalBooks: number;
  availableBooks: number;
  totalCommunities: number;
  totalTransactions: number;
  activeTransactions: number;
  pendingTransactions: number;
  completedTransactions: number;
}

const KpiCard = ({
  icon: Icon,
  label,
  value,
  bgColor,
  iconColor,
  textColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  bgColor: string;
  iconColor: string;
  textColor: string;
}) => (
  <Card className="overflow-hidden">
    <CardContent className="p-0">
      <div className={`${bgColor} px-5 py-4 flex items-center gap-4`}>
        <div className="shrink-0">
          <Icon className={`w-8 h-8 ${iconColor}`} />
        </div>
        <div>
          <p className={`text-xs font-medium uppercase tracking-wider ${iconColor} opacity-80`}>{label}</p>
          <p className={`text-3xl font-bold mt-0.5 ${textColor}`}>{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const MiniStatRow = ({
  icon: Icon,
  label,
  value,
  badge,
  badgeVariant = 'secondary',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}) => (
  <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
    <div className="flex items-center gap-2.5">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm text-foreground">{label}</span>
      {badge && <Badge variant={badgeVariant} className="text-xs">{badge}</Badge>}
    </div>
    <span className="text-sm font-semibold tabular-nums">{value}</span>
  </div>
);

export const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weekStart = subDays(new Date(), 7);

      const [
        { count: totalUsers },
        { count: newUsersToday },
        { count: newUsersThisWeek },
        { count: totalBooks },
        { count: availableBooks },
        { count: totalCommunities },
        { count: totalTransactions },
        { count: activeTransactions },
        { count: pendingTransactions },
        { count: completedTransactions },
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
        supabase.from('books').select('*', { count: 'exact', head: true }),
        supabase.from('books').select('*', { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('communities').select('id', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      ]);

      setStats({
        totalUsers: totalUsers ?? 0,
        newUsersToday: newUsersToday ?? 0,
        newUsersThisWeek: newUsersThisWeek ?? 0,
        totalBooks: totalBooks ?? 0,
        availableBooks: availableBooks ?? 0,
        totalCommunities: totalCommunities ?? 0,
        totalTransactions: totalTransactions ?? 0,
        activeTransactions: activeTransactions ?? 0,
        pendingTransactions: pendingTransactions ?? 0,
        completedTransactions: completedTransactions ?? 0,
      });
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  const availableRatio = stats.totalBooks > 0
    ? Math.round((stats.availableBooks / stats.totalBooks) * 100)
    : 0;
  const completedRatio = stats.totalTransactions > 0
    ? Math.round((stats.completedTransactions / stats.totalTransactions) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight">현황 대시보드</h2>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(lastUpdated, 'M월 d일 HH:mm 기준', { locale: ko })}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchStats(true)}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* KPI — 핵심 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Users}
          label="전체 사용자"
          value={stats.totalUsers.toLocaleString()}
          bgColor="bg-blue-500/10 dark:bg-blue-500/20"
          iconColor="text-blue-600 dark:text-blue-400"
          textColor="text-blue-700 dark:text-blue-300"
        />
        <KpiCard
          icon={BookOpen}
          label="등록 도서"
          value={stats.totalBooks.toLocaleString()}
          bgColor="bg-violet-500/10 dark:bg-violet-500/20"
          iconColor="text-violet-600 dark:text-violet-400"
          textColor="text-violet-700 dark:text-violet-300"
        />
        <KpiCard
          icon={ArrowLeftRight}
          label="진행중 거래"
          value={stats.activeTransactions}
          bgColor="bg-amber-500/10 dark:bg-amber-500/20"
          iconColor="text-amber-600 dark:text-amber-400"
          textColor="text-amber-700 dark:text-amber-300"
        />
        <KpiCard
          icon={Building2}
          label="커뮤니티"
          value={stats.totalCommunities.toLocaleString()}
          bgColor="bg-emerald-500/10 dark:bg-emerald-500/20"
          iconColor="text-emerald-600 dark:text-emerald-400"
          textColor="text-emerald-700 dark:text-emerald-300"
        />
      </div>

      {/* 오늘의 현황 + 주의 필요 항목 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* 오늘 활동 */}
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground mb-1">오늘 활동</p>
            <p className="text-xs text-muted-foreground mb-4">
              {format(new Date(), 'yyyy년 M월 d일 (E)', { locale: ko })} 기준
            </p>
            <MiniStatRow
              icon={UserPlus}
              label="신규 가입"
              value={`${stats.newUsersToday}명`}
              badge={stats.newUsersToday > 0 ? 'NEW' : undefined}
              badgeVariant="default"
            />
            <MiniStatRow
              icon={UserPlus}
              label="이번 주 가입"
              value={`${stats.newUsersThisWeek}명`}
              badge="7일"
              badgeVariant="secondary"
            />
          </CardContent>
        </Card>

        {/* 주의 필요 */}
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground mb-1">주의 필요</p>
            <p className="text-xs text-muted-foreground mb-4">확인이 필요한 항목</p>
            <MiniStatRow
              icon={AlertCircle}
              label="대기중 거래"
              value={`${stats.pendingTransactions}건`}
              badge={stats.pendingTransactions > 0 ? '확인 필요' : undefined}
              badgeVariant="destructive"
            />
            <MiniStatRow
              icon={Clock}
              label="진행중 거래"
              value={`${stats.activeTransactions}건`}
            />
            <MiniStatRow
              icon={CheckCircle2}
              label="완료된 거래"
              value={`${stats.completedTransactions}건`}
              badge={`${completedRatio}%`}
              badgeVariant="secondary"
            />
          </CardContent>
        </Card>
      </div>

      {/* 도서 현황 */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">도서 현황</p>
            <span className="text-xs text-muted-foreground">전체 {stats.totalBooks.toLocaleString()}권</span>
          </div>
          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>대여 가능 비율</span>
              <span className="font-semibold text-primary">{availableRatio}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${availableRatio}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-primary/5 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">{stats.availableBooks}</p>
              <p className="text-xs text-muted-foreground mt-0.5">대여 가능</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{stats.totalBooks - stats.availableBooks}</p>
              <p className="text-xs text-muted-foreground mt-0.5">대여중·판매완료</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
