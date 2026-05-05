import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Trash2, Loader2, BookOpen, AlertTriangle } from 'lucide-react';
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

  useEffect(() => { fetchBooks(); }, []);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('books')
        .select(`id, title, author, status, mode, is_public, created_at,
          owner:profiles!books_owner_id_fkey(nickname),
          community:communities(name)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBooks((data || []).map((b: any) => ({
        id: b.id, title: b.title, author: b.author, status: b.status,
        mode: b.mode, is_public: b.is_public, created_at: b.created_at,
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

  const filteredBooks = books.filter(
    (b) => b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.owner_nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            도서 관리
            <Badge variant="secondary" className="ml-2">{books.length}권</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="제목, 저자, 소유자로 검색..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
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
    </>
  );
};
