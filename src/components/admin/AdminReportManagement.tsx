import { useState, useEffect, useCallback } from 'react';
import { Flag, Loader2, Check, X, Eye, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { REPORT_REASONS, ReportStatus, ReportTargetType } from '@/hooks/useReports';

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  target_type: ReportTargetType;
  target_id: string | null;
  reason: string;
  detail: string | null;
  context: string | null;
  status: ReportStatus;
  admin_note: string | null;
  created_at: string;
  reporter?: { nickname: string } | null;
  reported?: { nickname: string } | null;
}

const STATUS_META: Record<ReportStatus, { label: string; className: string }> = {
  pending: { label: '대기', className: 'bg-destructive/15 text-destructive' },
  reviewing: { label: '검토 중', className: 'bg-primary/15 text-primary' },
  resolved: { label: '조치 완료', className: 'bg-emerald-500/15 text-emerald-600' },
  dismissed: { label: '기각', className: 'bg-muted text-muted-foreground' },
};

const TARGET_LABELS: Record<ReportTargetType, string> = {
  book: '책',
  message: '메시지',
  post: '게시글',
  comment: '댓글',
  user: '사용자',
};

const reasonLabel = (value: string) =>
  REPORT_REASONS.find((r) => r.value === value)?.label ?? value;

export const AdminReportManagement = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportStatus | 'all'>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('reports')
      .select(`
        *,
        reporter:profiles!reports_reporter_id_fkey(nickname),
        reported:profiles!reports_reported_user_id_fkey(nickname)
      `)
      .order('created_at', { ascending: false });

    if (filter !== 'all') query = query.eq('status', filter);

    const { data, error } = await query;
    if (error) {
      toast.error('신고 목록을 불러오지 못했습니다');
      console.error(error);
    } else {
      setReports((data ?? []) as unknown as ReportRow[]);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const updateStatus = async (report: ReportRow, status: ReportStatus) => {
    setActingId(report.id);
    const { error } = await supabase
      .from('reports')
      .update({
        status,
        admin_note: notes[report.id]?.trim() || report.admin_note,
        resolved_by: user?.id ?? null,
        resolved_at: status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : null,
      })
      .eq('id', report.id);

    setActingId(null);
    if (error) {
      toast.error('처리에 실패했습니다');
      return;
    }
    toast.success(`'${STATUS_META[status].label}'로 변경했습니다`);
    fetchReports();
  };

  /** 신고된 콘텐츠를 실제로 삭제한다. 신고 접수만으로는 조치가 아니다. */
  const deleteReportedContent = async (report: ReportRow) => {
    if (!report.target_id) return;
    const table =
      report.target_type === 'book'
        ? 'books'
        : report.target_type === 'message'
        ? 'messages'
        : null;

    if (!table) {
      toast.error('이 유형은 직접 삭제를 지원하지 않습니다. 사용자 관리 탭에서 조치하세요.');
      return;
    }

    setActingId(report.id);
    const { error } = await supabase.from(table).delete().eq('id', report.target_id);
    setActingId(null);

    if (error) {
      toast.error('콘텐츠 삭제에 실패했습니다');
      return;
    }
    toast.success('콘텐츠를 삭제했습니다');
    updateStatus(report, 'resolved');
  };

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-destructive" />
          <h2 className="font-display text-xl font-medium">신고 관리</h2>
          {filter === 'pending' && pendingCount > 0 && (
            <Badge variant="destructive">{pendingCount}건 대기</Badge>
          )}
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as ReportStatus | 'all')}>
          <TabsList>
            <TabsTrigger value="pending">대기</TabsTrigger>
            <TabsTrigger value="reviewing">검토 중</TabsTrigger>
            <TabsTrigger value="resolved">완료</TabsTrigger>
            <TabsTrigger value="dismissed">기각</TabsTrigger>
            <TabsTrigger value="all">전체</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : reports.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Flag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">해당 상태의 신고가 없습니다</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={STATUS_META[report.status].className} variant="secondary">
                      {STATUS_META[report.status].label}
                    </Badge>
                    <Badge variant="outline">{TARGET_LABELS[report.target_type]}</Badge>
                    <span className="text-sm font-medium">{reasonLabel(report.reason)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    신고자 <b>{report.reporter?.nickname ?? '알 수 없음'}</b>
                    {report.reported?.nickname && (
                      <> → 대상 <b>{report.reported.nickname}</b></>
                    )}
                    {' · '}
                    {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: ko })}
                  </p>
                </div>
              </div>

              {report.detail && (
                <p className="text-sm bg-muted/50 rounded-xl p-3">{report.detail}</p>
              )}

              {report.context && (
                <div className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
                  <span className="font-semibold">신고 시점 콘텐츠: </span>
                  <span className="line-clamp-3">{report.context}</span>
                </div>
              )}

              {(report.status === 'pending' || report.status === 'reviewing') && (
                <>
                  <Textarea
                    placeholder="처리 메모 (선택)"
                    value={notes[report.id] ?? report.admin_note ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
                    rows={2}
                    className="rounded-xl resize-none text-sm"
                  />

                  <div className="flex flex-wrap gap-2">
                    {report.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full gap-1.5"
                        disabled={actingId === report.id}
                        onClick={() => updateStatus(report, 'reviewing')}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        검토 시작
                      </Button>
                    )}
                    {report.target_id &&
                      (report.target_type === 'book' || report.target_type === 'message') && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="rounded-full gap-1.5"
                          disabled={actingId === report.id}
                          onClick={() => deleteReportedContent(report)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          콘텐츠 삭제 + 완료
                        </Button>
                      )}
                    <Button
                      size="sm"
                      className="rounded-full gap-1.5"
                      disabled={actingId === report.id}
                      onClick={() => updateStatus(report, 'resolved')}
                    >
                      <Check className="w-3.5 h-3.5" />
                      조치 완료
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full gap-1.5"
                      disabled={actingId === report.id}
                      onClick={() => updateStatus(report, 'dismissed')}
                    >
                      <X className="w-3.5 h-3.5" />
                      기각
                    </Button>
                  </div>
                </>
              )}

              {report.admin_note && report.status !== 'pending' && report.status !== 'reviewing' && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">처리 메모: </span>
                  {report.admin_note}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
