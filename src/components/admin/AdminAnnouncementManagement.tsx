import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Mail, Save, Loader2, History, Send } from 'lucide-react';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface AnnouncementHistoryItem {
  id: string;
  message: string;
  created_at: string;
  creator_nickname: string | null;
}

export const AdminAnnouncementManagement = () => {
  const { user } = useAuth();
  const { announcement, isLoading, updateAnnouncement, isUpdating } = useAnnouncement();
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<AnnouncementHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    if (announcement?.admin_message) {
      setMessage(announcement.admin_message);
    }
    fetchHistory();
  }, [announcement]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await supabase
        .from('announcement_history')
        .select(`
          id, message, created_at,
          creator:profiles(nickname)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      setHistory(
        (data || []).map((item: any) => ({
          id: item.id,
          message: item.message,
          created_at: item.created_at,
          creator_nickname: item.creator?.nickname || null,
        }))
      );
    } catch (err) {
      console.error('Failed to fetch announcement history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Save to history first
    try {
      await supabase.from('announcement_history').insert({
        message: message.trim(),
        created_by: user?.id ?? null,
      });
    } catch (err) {
      console.error('Failed to save announcement history:', err);
    }

    updateAnnouncement(message.trim());
    fetchHistory();
  };

  const handleUseHistoryItem = (msg: string) => {
    setMessage(msg);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasChanges = message !== (announcement?.admin_message || '');

  return (
    <div className="space-y-6">
      {/* Edit card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <CardTitle className="font-display text-xl font-medium tracking-tight">공지 관리</CardTitle>
          </div>
          <CardDescription>
            전체 사용자에게 표시될 관리자 메시지를 작성하세요.
            메시지 저장 시 이력이 기록되고, 모든 사용자에게 새 알림이 표시됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="announcement">관리자 메시지</Label>
                <Textarea
                  id="announcement"
                  placeholder="사용자들에게 전달할 메시지를 입력하세요..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
              </div>

              {announcement?.updated_at && (
                <p className="text-sm text-muted-foreground">
                  마지막 업데이트: {format(new Date(announcement.updated_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isUpdating || !hasChanges || !message.trim()}
                  className="flex items-center gap-2"
                >
                  {isUpdating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  발송 및 저장
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base font-medium tracking-tight">현재 표시 중인 공지</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
              <Mail className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">관리자의 한마디</span>
            </div>
            {announcement?.admin_message ? (
              <p className="text-sm whitespace-pre-wrap">{announcement.admin_message}</p>
            ) : (
              <p className="text-sm text-muted-foreground">현재 공지 없음</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="font-display text-xl font-medium tracking-tight">공지 이력</CardTitle>
            <Badge variant="secondary" className="ml-1">{history.length}건</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">공지 이력이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-muted/40 rounded-xl border border-border space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{format(new Date(item.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}</span>
                      {item.creator_nickname && (
                        <Badge variant="outline" className="text-xs">{item.creator_nickname}</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => handleUseHistoryItem(item.message)}
                    >
                      재사용
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap line-clamp-3">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
