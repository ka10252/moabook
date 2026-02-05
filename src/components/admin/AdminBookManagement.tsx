import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Trash2, Loader2, BookOpen, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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

export const AdminBookManagement = () => {
  const [books, setBooks] = useState<BookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteBookId, setDeleteBookId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('books')
        .select(`
          id, title, author, status, mode, is_public, created_at,
          owner:profiles!books_owner_id_fkey(nickname),
          community:communities(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedBooks = (data || []).map((book: any) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        status: book.status,
        mode: book.mode,
        is_public: book.is_public,
        created_at: book.created_at,
        owner_nickname: book.owner?.nickname || '알 수 없음',
        community_name: book.community?.name || null,
      }));

      setBooks(formattedBooks);
    } catch (err) {
      console.error('Failed to fetch books:', err);
      toast.error('도서 목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async () => {
    if (!deleteBookId) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', deleteBookId);

      if (error) throw error;

      setBooks((prev) => prev.filter((b) => b.id !== deleteBookId));
      toast.success('도서가 삭제되었습니다');
    } catch (err) {
      console.error('Failed to delete book:', err);
      toast.error('도서 삭제에 실패했습니다');
    } finally {
      setDeleting(false);
      setDeleteBookId(null);
    }
  };

  const filteredBooks = books.filter(
    (book) =>
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.owner_nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      available: 'default',
      rented: 'secondary',
      sold: 'destructive',
    };
    const labels: Record<string, string> = {
      available: '대여가능',
      rented: '대여중',
      sold: '판매완료',
    };
    return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            도서 관리
            <Badge variant="secondary" className="ml-2">
              {books.length}권
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="제목, 저자, 소유자로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>도서</TableHead>
                    <TableHead>소유자</TableHead>
                    <TableHead>커뮤니티</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                    <TableHead>등록일</TableHead>
                    <TableHead className="text-right">삭제</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBooks.map((book) => (
                    <TableRow key={book.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{book.title}</p>
                          <p className="text-sm text-muted-foreground">{book.author}</p>
                        </div>
                      </TableCell>
                      <TableCell>{book.owner_nickname}</TableCell>
                      <TableCell>
                        {book.community_name ? (
                          <Badge variant="outline">{book.community_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          {getStatusBadge(book.status)}
                          <Badge variant="outline" className="text-xs">
                            {book.mode === 'rent' ? '대여' : '판매'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(book.created_at), 'yyyy.MM.dd', { locale: ko })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteBookId(book.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredBooks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        검색 결과가 없습니다
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteBookId} onOpenChange={() => setDeleteBookId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              도서 삭제
            </AlertDialogTitle>
            <AlertDialogDescription>
              이 도서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 관련된 모든 거래 기록에 영향을 줄 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBook}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
