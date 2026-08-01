import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity, Users, UserPlus, LogIn, Eye, Send, Search,
  SearchX, PackageOpen, RefreshCw, Loader2, TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Overview {
  days: number;
  sessions: number;
  active_users: number;
  signups: number;
  logins: number;
  onboarding_done: number;
  onboarding_skipped: number;
  book_views: number;
  requests: number;
  searches: number;
  no_result_searches: number;
  borrow_gate_shown: number;
  total_events: number;
}
interface GateConv {
  days: number;
  shown_events: number;
  shown_users: number;
  converted_users: number;
  conversion_rate: number;
}
interface DailyRow { day: string; users: number; sessions: number; ev_count: number; }
interface NoResultRow { query: string; cnt: number; }

const RANGES = [7, 14, 30] as const;

const StatCard = ({
  icon: Icon, label, value, hint,
}: { icon: React.ElementType; label: string; value: string | number; hint?: string }) => (
  <Card className="overflow-hidden">
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold mt-1.5 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </CardContent>
  </Card>
);

export const AdminMetrics = () => {
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [gate, setGate] = useState<GateConv | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [noResult, setNoResult] = useState<NoResultRow[]>([]);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [ov, gc, da, nr] = await Promise.all([
        supabase.rpc('admin_metrics_overview' as any, { p_days: days }),
        supabase.rpc('admin_borrow_gate_conversion' as any, { p_days: Math.max(days, 30) }),
        supabase.rpc('admin_daily_active' as any, { p_days: days }),
        supabase.rpc('admin_top_no_result' as any, { p_days: Math.max(days, 30), p_limit: 15 }),
      ]);
      const firstErr = ov.error || gc.error || da.error || nr.error;
      if (firstErr) throw firstErr;
      setOverview(ov.data as Overview);
      setGate(gc.data as GateConv);
      setDaily((da.data as DailyRow[]) ?? []);
      setNoResult((nr.data as NoResultRow[]) ?? []);
      setLastUpdated(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 마이그레이션 미실행이면 함수가 없어 404/PGRST202가 온다 — 안내로 바꿔준다.
      setError(
        /not find|does not exist|PGRST202|schema cache/i.test(msg)
          ? '지표 함수가 아직 배포되지 않았어요. 마이그레이션(20260802000002_admin_metrics.sql)을 실행해주세요.'
          : msg,
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const maxDailyEvents = Math.max(1, ...daily.map((d) => d.ev_count));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + range */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight">행동 지표</h2>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(lastUpdated, 'M월 d일 HH:mm 기준', { locale: ko })} · 최근 {days}일
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === r ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {r}일
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchAll(true)} disabled={refreshing} className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="p-5 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {overview && (
        <>
          {/* 핵심 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Activity} label="세션" value={overview.sessions.toLocaleString()} />
            <StatCard icon={Users} label="활성 유저" value={overview.active_users.toLocaleString()} hint="로그인 기준" />
            <StatCard icon={UserPlus} label="가입" value={overview.signups.toLocaleString()} />
            <StatCard icon={LogIn} label="로그인" value={overview.logins.toLocaleString()} />
            <StatCard icon={Eye} label="책 조회" value={overview.book_views.toLocaleString()} />
            <StatCard icon={Send} label="대여/거래 요청" value={overview.requests.toLocaleString()} />
            <StatCard icon={Search} label="검색" value={overview.searches.toLocaleString()} />
            <StatCard
              icon={SearchX}
              label="결과없음 검색"
              value={overview.no_result_searches.toLocaleString()}
              hint={overview.searches > 0 ? `${Math.round((overview.no_result_searches / overview.searches) * 100)}%` : undefined}
            />
          </div>

          {/* 대여 게이트 전환 */}
          {gate && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <PackageOpen className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">대여 게이트 전환 <span className="text-muted-foreground font-normal">(최근 {gate.days}일)</span></p>
                </div>
                <p className="text-xs text-muted-foreground mb-4">책이 없어 요청이 막힌 유저 중, 이후 책을 등록한 비율</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold tabular-nums">{gate.shown_users}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">게이트 본 유저</p>
                  </div>
                  <div className="bg-primary/5 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-primary tabular-nums">{gate.converted_users}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">책 등록함</p>
                  </div>
                  <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{gate.conversion_rate}%</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">전환율</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 일자별 활성 */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-semibold">일자별 활동</p>
              </div>
              {daily.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">데이터가 아직 없어요</p>
              ) : (
                <div className="space-y-1.5">
                  {daily.map((d) => (
                    <div key={d.day} className="flex items-center gap-3">
                      <span className="text-[11px] text-muted-foreground w-14 shrink-0 tabular-nums">
                        {format(new Date(d.day), 'M/d', { locale: ko })}
                      </span>
                      <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-primary/70 rounded transition-all"
                          style={{ width: `${(d.ev_count / maxDailyEvents) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums w-24 text-right shrink-0 text-muted-foreground">
                        {d.users}명 · {d.ev_count}건
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 결과 없던 검색어 */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <SearchX className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-semibold">결과 없던 검색어 <span className="text-muted-foreground font-normal">(최근 30일)</span></p>
              </div>
              <p className="text-xs text-muted-foreground mb-4">공급이 부족한 책 신호 — 어떤 책을 찾다 못 찾았나</p>
              {noResult.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">결과 없던 검색이 없어요</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {noResult.map((r) => (
                    <Badge key={r.query} variant="secondary" className="text-xs font-normal">
                      {r.query} <span className="ml-1 text-muted-foreground tabular-nums">{r.cnt}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
