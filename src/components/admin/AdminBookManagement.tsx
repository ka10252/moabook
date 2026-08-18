import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Trash2, Loader2, BookOpen, AlertTriangle, EyeOff, Eye, History } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BookData {
  id: string;
  title: string;
  author: string;
  status: string;
  mode: string;
  is_public: boolean;
  created_at: string;
  hidden_at: string | null;
  hidden_reason: string | null;
  owner_nickname: string;
  community_name: string | null;
}

const STATUS_LABEL: Record<string, string> = { available: '대여가능', rented: '대여중', sold: '판매완료' };
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = { available: 'default', rented: 'secondary', sold: 'destructive' };

export const AdminBookManagement = () => {
  const [books, setBooks] = useState<BookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteBookId, setDeleteBookId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // 숨김 대상 — 사유를 받고 확인한 뒤에 처리한다. 실수로 눌러 바로 숨겨지면 안 된다.
  const [hideTarget, setHideTarget] = useState<BookData | null>(null);
  const [hideReason, setHideReason] = useState('');
  const [hiding, setHiding] = useState(false);
  // 숨긴 책만 모아 보기 — 신고 처리 후 "지금 뭐가 숨겨져 있지?"를 바로 확인해야 한다.
  const [onlyHidden, setOnlyHidden] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [log, setLog] = useState<Array<{ id: string; book_title: string | null; action: string; reason: string | null; created_at: string }>>([]);
  const [logLoading, setLogLoading] = useState(false);

  const fetchLog = async () => {
    setLogLoading(true);
    const { data } = await supabase
      .from('book_hide_log' as never)
      .select('id, book_title, action, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    setLog((data ?? []) as never);
    setLogLoading(false);
  };

  const setHidden = async (book: BookData, hidden: boolean, reason?: string) => {
    setHiding(true);
    try {
      const { error } = await supabase.rpc('admin_set_book_hidden' as never, {
        p_book_id: book.id, p_hidden: hidden, p_reason: reason ?? null,
      } as never);
      if (error) throw error;
      toast.success(hidden ? '책을 숨겼습니다' : '숨김을 해제했습니다');
      setHideTarget(null);
      setHideReason('');
      await fetchBooks();
    } catch {
      toast.error(hidden ? '숨기지 못했습니다' : '해제하지 못했습니다');
    } finally {
      setHiding(false);
    }
  };

  useEffect(() => { fetchBooks(); }, []);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('books')
        .select(`id, title, author, status, mode, is_public, created_at, hidden_at, hidden_reason,
          owner:profiles!books_owner_id_fkey(nickname),
          community:communities!books_community_id_fkey(name)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBooks((data || []).map((b: any) => ({
        id: b.id, title: b.title, author: b.author, status: b.status,
        mode: b.mode, is_public: b.is_public, created_at: b.created_at,
        // 여기서 빠뜨리면 셀렉트에 넣어도 화면에는 undefined로 온다.
        // '숨긴 책만' 필터와 숨김/해제 버튼 전환이 전부 이 값으로 갈린다.
        hidden_at: b.hidden_at ?? null,
        hidden_reason: b.hidden_reason ?? null,
        owner_nickname: b.owner?.nickname || '알 수 없음',
        community_name: b.community?.name || null,
      })));
    } catch (err) {
      toast.error('도서 목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async () => {
    if (!deleteBookId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('books').delete().eq('id', deleteBookId);
      if (error) throw error;
      setBooks((prev) => prev.filter((b) => b.id !== deleteBookId));
      toast.success('도서가 삭제되었습니다');
    } catch {
      toast.error('도서 삭제에 실패했습니다');
    } finally {
      setDeleting(false);
      setDeleteBookId(null);
    }
  };

  const filteredBooksBase = books.filter(
    (b) => b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.owner_nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredBooks = onlyHidden ? filteredBooksBase.filter(b => !!b.hidden_at) : filteredBooksBase;


  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            도서 관리
            <Badge variant="secondary" className="ml-2">{books.length}권</Badge>
            {books.filter(b => b.hidden_at).length > 0 && (
              <Badge variant="destructive" className="ml-1">숨김 {books.filter(b => b.hidden_at).length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="제목, 저자, 소유자로 검색..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Button
              variant={onlyHidden ? 'default' : 'outline'}
              onClick={() => setOnlyHidden(v => !v)}
              className="gap-1.5"
            >
              <EyeOff className="w-4 h-4" />
              숨긴 책만
            </Button>
            <Button
              variant="outline"
              onClick={() => { setShowLog(true); fetchLog(); }}
              className="gap-1.5"
            >
              <History className="w-4 h-4" />
              숨김 기록
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredBooks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">검색 결과가 없습니다</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 pb-3 font-medium">도서</th>
                      <th className="text-left py-2 pb-3 font-medium">소유자</th>
                      <th className="text-left py-2 pb-3 font-medium">커뮤니티</th>
                      <th className="text-center py-2 pb-3 font-medium">상태</th>
                      <th className="text-left py-2 pb-3 font-medium">등록일</th>
                      <th className="text-center py-2 pb-3 font-medium">노출</th>
                      <th className="text-right py-2 pb-3 font-medium">삭제</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredBooks.map((book) => (
                      <tr key={book.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4">
                          <p className="font-medium">{book.title}</p>
                          <p className="text-xs text-muted-foreground">{book.author}</p>
                        </td>
                        <td className="py-3 pr-4 text-sm">{book.owner_nickname}</td>
                        <td className="py-3 pr-4">
                          {book.community_name
                            ? <Badge variant="outline">{book.community_name}</Badge>
                            : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant={STATUS_VARIANT[book.status] || 'default'}>{STATUS_LABEL[book.status] || book.status}</Badge>
                            <Badge variant="outline" className="text-xs">{book.mode === 'rent' ? '대여' : '판매'}</Badge>
                          </div>
                        </td>
                        <td className="py-3 text-muted-foreground text-sm">{format(new Date(book.created_at), 'yyyy.MM.dd', { locale: ko })}</td>
                        <td className="py-3 text-center">
                          {book.hidden_at ? (
                            <Button
                              variant="outline" size="sm" disabled={hiding}
                              onClick={() => setHidden(book, false)}
                              title={book.hidden_reason || '숨김'}
                              className="gap-1.5"
                            >
                              <EyeOff className="w-3.5 h-3.5 text-destructive" />
                              <span className="text-xs">숨김 해제</span>
                            </Button>
                          ) : (
                            <Button
                              variant="ghost" size="sm" disabled={hiding}
                              onClick={() => { setHideTarget(book); setHideReason(''); }}
                              className="gap-1.5 text-muted-foreground"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="text-xs">숨기기</span>
                            </Button>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <Button variant="ghost" size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteBookId(book.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {filteredBooks.map((book) => (
                  <div key={book.id} className="p-3 bg-muted/30 rounded-xl border border-border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{book.title}</p>
                        <p className="text-xs text-muted-foreground">{book.author} · {book.owner_nickname}</p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <Badge variant={STATUS_VARIANT[book.status] || 'default'} className="text-xs">
                            {STATUS_LABEL[book.status] || book.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{book.mode === 'rent' ? '대여' : '판매'}</Badge>
                          {book.community_name && <Badge variant="outline" className="text-xs">{book.community_name}</Badge>}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 -mt-1"
                        onClick={() => setDeleteBookId(book.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{format(new Date(book.created_at), 'yyyy.MM.dd', { locale: ko })} 등록</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteBookId} onOpenChange={() => setDeleteBookId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />도서 삭제
            </AlertDialogTitle>
            <AlertDialogDescription>
              이 도서를 삭제하시겠습니까? 되돌릴 수 없으며 관련 거래 기록에 영향을 줄 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBook} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 숨김 확인 — 사유를 남긴다. 나중에 "왜 숨겼더라"를 못 찾으면 해제 판단을 못 한다. */}
      <AlertDialog open={!!hideTarget} onOpenChange={(v) => { if (!v) setHideTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 책을 숨길까요?</AlertDialogTitle>
            <AlertDialogDescription>
              「{hideTarget?.title}」이(가) 서가·검색·지도에서 사라집니다.
              <br />
              <b className="text-foreground">주인에게는 계속 보이고</b>, 숨겨졌다는 안내가 함께 뜹니다. 언제든 해제할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={hideReason}
            onChange={(e) => setHideReason(e.target.value.slice(0, 100))}
            placeholder="사유 (선택) — 예: 신고 누적, 부적절한 이미지"
            className="mt-1"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={hiding}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (hideTarget) setHidden(hideTarget, true, hideReason); }}
              disabled={hiding}
            >
              {hiding ? <Loader2 className="w-4 h-4 animate-spin" /> : '숨기기'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* 숨김 기록 — 해제하면 books.hidden_reason은 지워지므로 사유는 여기에만 남는다 */}
      <AlertDialog open={showLog} onOpenChange={setShowLog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" /> 숨김 기록
            </AlertDialogTitle>
            <AlertDialogDescription>
              최근 100건. 같은 책이 반복해서 올라오는지도 여기서 보입니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[55vh] overflow-y-auto -mx-2 px-2">
            {logLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : log.length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-sm">아직 기록이 없습니다</p>
            ) : (
              <ul className="divide-y divide-border">
                {log.map((row) => (
                  <li key={row.id} className="py-2.5 flex items-start gap-3">
                    <Badge variant={row.action === 'hide' ? 'destructive' : 'secondary'} className="mt-0.5 shrink-0">
                      {row.action === 'hide' ? '숨김' : '해제'}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{row.book_title || '(삭제된 책)'}</p>
                      {row.reason && <p className="text-xs text-muted-foreground mt-0.5">{row.reason}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(row.created_at), 'yy.MM.dd HH:mm', { locale: ko })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>닫기</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
