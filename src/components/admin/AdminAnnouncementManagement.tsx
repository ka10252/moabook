import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Save, Loader2 } from 'lucide-react';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export const AdminAnnouncementManagement = () => {
  const { announcement, isLoading, updateAnnouncement, isUpdating } = useAnnouncement();
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (announcement?.admin_message) {
      setMessage(announcement.admin_message);
    }
  }, [announcement]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAnnouncement(message);
  };

  const hasChanges = message !== (announcement?.admin_message || '');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <CardTitle>공지 관리</CardTitle>
          </div>
          <CardDescription>
            전체 사용자에게 표시될 관리자 메시지를 작성하세요. 
            메시지 업데이트 시 모든 사용자에게 새 알림 표시가 나타납니다.
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
                  disabled={isUpdating || !hasChanges}
                  className="flex items-center gap-2"
                >
                  {isUpdating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  업데이트
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">미리보기</CardTitle>
          <CardDescription>
            사용자에게 표시되는 공지 팝업 미리보기입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
              <Mail className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">관리자의 한마디</span>
            </div>
            {message ? (
              <p className="text-sm whitespace-pre-wrap">{message}</p>
            ) : (
              <p className="text-sm text-muted-foreground">메시지가 없습니다.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
