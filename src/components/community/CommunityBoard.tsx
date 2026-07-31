import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, MessageCircle, Trash2, Loader2, ChevronDown, ChevronUp, BookOpen, BookPlus, X, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { BookMode } from '@/lib/bookMode';

interface PostBook {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  mode: BookMode;
  condition: 'S' | 'A' | 'B';
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author: { nickname: string; avatar_url: string | null } | null;
  comment_count: number;
  book: PostBook | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author: { nickname: string; avatar_url: string | null } | null;
}

interface CommunityBoardProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
  communityName: string;
}

const timeAgo = (date: string) =>
  formatDistanceToNow(new Date(date), { addSuffix: true, locale: ko });

function BookCard({ book }: { book: PostBook }) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/40 flex gap-3 p-3 overflow-hidden">
      {book.cover_url ? (
        <img
          src={book.cover_url}
          alt={book.title}
          className="w-11 h-[60px] object-cover rounded-lg shrink-0"
        />
      ) : (
        <div className="w-11 h-[60px] rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="text-sm font-semibold text-foreground truncate leading-tight">{book.title}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{book.author}</p>
        <div className="flex gap-1.5 mt-1.5">
          <span className={`text-[12px] px-1.5 py-0.5 rounded-full font-medium ${
            book.mode === 'rent' ? 'bg-primary/10 text-primary' : 'bg-accent/20 text-accent-foreground'
          }`}>
            {book.mode === 'rent' ? '대여' : '판매'}
          </span>
          <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {book.condition === 'S' ? '새 책' : book.condition === 'A' ? '양호' : '보통'}
          </span>
        </div>
      </div>
    </div>
  );
}

function PostItem({
  post,
  currentUserId,
  onDelete,
}: {
  post: Post;
  currentUserId: string | undefined;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadComments = async () => {
    if (commentsLoaded) return;
    setLoadingComments(true);
    const { data } = await supabase
      .from('community_comments')
      .select('*, author:profiles(nickname, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    setComments((data || []) as Comment[]);
    setCommentsLoaded(true);
    setLoadingComments(false);
  };

  const handleToggle = () => {
    if (!expanded) loadComments();
    setExpanded(v => !v);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from('community_comments')
      .insert({ post_id: post.id, author_id: currentUserId, content: newComment.trim() })
      .select('*, author:profiles(nickname, avatar_url)')
      .single();
    if (error) { toast.error('댓글 등록에 실패했습니다'); }
    else { setComments(prev => [...prev, data as Comment]); setNewComment(''); }
    setSubmitting(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from('community_comments').delete().eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Post body */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarImage src={post.author?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {post.author?.nickname?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground truncate">
                {post.author?.nickname || '알 수 없음'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[13px] text-muted-foreground">{timeAgo(post.created_at)}</span>
                {post.author_id === currentUserId && (
                  <button
                    onClick={() => onDelete(post.id)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">{post.content}</p>
            {post.book && <BookCard book={post.book} />}
          </div>
        </div>

        {/* Comment toggle */}
        <button
          onClick={handleToggle}
          className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>댓글 {post.comment_count > 0 ? post.comment_count : ''}</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Comments section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="bg-muted/30 px-4 py-3 space-y-3">
              {loadingComments ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">첫 댓글을 남겨보세요</p>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="flex items-start gap-2">
                    <Avatar className="w-7 h-7 shrink-0">
                      <AvatarImage src={c.author?.avatar_url || undefined} />
                      <AvatarFallback className="bg-secondary text-[12px]">
                        {c.author?.nickname?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 bg-card rounded-xl px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {c.author?.nickname || '알 수 없음'}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[12px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                          {c.author_id === currentUserId && (
                            <button
                              onClick={() => handleDeleteComment(c.id)}
                              className="p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
                    </div>
                  </div>
                ))
              )}

              {/* Comment input */}
              {currentUserId && (
                <div className="flex gap-2">
                  <Textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="댓글 입력…"
                    rows={1}
                    className="resize-none text-sm rounded-xl bg-card border-border min-h-0 py-2"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                  />
                  <Button
                    size="icon"
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || submitting}
                    className="rounded-xl shrink-0 h-9 w-9"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const CommunityBoard = ({ isOpen, onClose, communityId, communityName }: CommunityBoardProps) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Book attachment state
  const [selectedBook, setSelectedBook] = useState<PostBook | null>(null);
  const [showBookSearch, setShowBookSearch] = useState(false);
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState<PostBook[]>([]);
  const [searchingBooks, setSearchingBooks] = useState(false);
  const bookSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchPosts();
  }, [isOpen, communityId]);

  useEffect(() => {
    if (showBookSearch) {
      setTimeout(() => bookSearchRef.current?.focus(), 50);
    } else {
      setBookQuery('');
      setBookResults([]);
    }
  }, [showBookSearch]);

  useEffect(() => {
    if (!showBookSearch) return;
    if (!bookQuery.trim()) { setBookResults([]); return; }
    const timer = setTimeout(() => searchBooks(bookQuery), 250);
    return () => clearTimeout(timer);
  }, [bookQuery]);

  const searchBooks = async (query: string) => {
    setSearchingBooks(true);
    const { data } = await supabase
      .from('books')
      .select('id, title, author, cover_url, mode, condition')
      .eq('community_id', communityId)
      .ilike('title', `%${query}%`)
      .limit(6);
    setBookResults((data || []) as PostBook[]);
    setSearchingBooks(false);
  };

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('community_posts')
      .select(`
        *,
        author:profiles(nickname, avatar_url),
        book:books(id, title, author, cover_url, mode, condition),
        community_comments(count)
      `)
      .eq('community_id', communityId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchPosts error:', error);
      if (error.code === '42P01') {
        toast.error('게시판 테이블이 없습니다. DB 마이그레이션을 먼저 실행해주세요.');
      }
    }

    setPosts(
      (data || []).map((p: any) => ({
        ...p,
        book: p.book ?? null,
        comment_count: Number(p.community_comments?.[0]?.count ?? 0),
      }))
    );
    setLoading(false);
  };

  const handleSubmitPost = async () => {
    if (!newPost.trim() || !user || submitting) return;
    setSubmitting(true);

    const payload: any = {
      community_id: communityId,
      author_id: user.id,
      content: newPost.trim(),
    };
    if (selectedBook) payload.book_id = selectedBook.id;

    const { data: inserted, error: insertError } = await supabase
      .from('community_posts')
      .insert(payload)
      .select('id')
      .single();

    if (insertError) {
      console.error('insert post error:', insertError);
      toast.error(`게시글 등록 실패: ${insertError.message}`);
      setSubmitting(false);
      return;
    }

    const { data } = await supabase
      .from('community_posts')
      .select('*, author:profiles(nickname, avatar_url), book:books(id, title, author, cover_url, mode, condition)')
      .eq('id', inserted.id)
      .single();

    if (data) {
      setPosts(prev => [{ ...(data as any), book: (data as any).book ?? null, comment_count: 0 }, ...prev]);
      setNewPost('');
      setSelectedBook(null);
      setShowBookSearch(false);
    }
    setSubmitting(false);
  };

  const handleDeletePost = async (postId: string) => {
    await supabase.from('community_posts').delete().eq('id', postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    toast.success('게시글이 삭제되었습니다');
  };

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col">
          {/* Header */}
          <header className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0 bg-background/80 backdrop-blur-md">
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div>
              <p className="text-[13px] text-muted-foreground uppercase tracking-widest leading-none">{communityName}</p>
              <h2 className="font-bold text-foreground text-base leading-tight">게시판</h2>
            </div>
          </header>

          {/* Post composer */}
          {user && (
            <div className="px-4 py-3 border-b border-border shrink-0">
              <Textarea
                ref={textareaRef}
                value={newPost}
                onChange={e => setNewPost(e.target.value)}
                placeholder="리뷰나 소식을 남겨보세요…"
                rows={2}
                className="resize-none text-sm rounded-xl bg-secondary border-border"
              />

              {/* Selected book preview */}
              {selectedBook && (
                <div className="mt-2 relative">
                  <BookCard book={selectedBook} />
                  <button
                    onClick={() => { setSelectedBook(null); setShowBookSearch(false); }}
                    className="absolute top-2 right-2 p-0.5 rounded-full bg-card/80 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Book search dropdown */}
              {showBookSearch && !selectedBook && (
                <div className="mt-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      ref={bookSearchRef}
                      value={bookQuery}
                      onChange={e => setBookQuery(e.target.value)}
                      placeholder="책 제목 검색…"
                      className="pl-9 h-9 text-sm rounded-xl bg-secondary border-border"
                    />
                  </div>
                  {(bookResults.length > 0 || searchingBooks) && (
                    <div className="mt-1 bg-card border border-border rounded-xl overflow-hidden shadow-md">
                      {searchingBooks ? (
                        <div className="flex justify-center py-3">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        bookResults.map(b => (
                          <button
                            key={b.id}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-0"
                            onClick={() => { setSelectedBook(b); setShowBookSearch(false); }}
                          >
                            {b.cover_url ? (
                              <img src={b.cover_url} loading="lazy" decoding="async" className="w-8 h-10 object-cover rounded shrink-0" />
                            ) : (
                              <div className="w-8 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                <BookOpen className="w-4 h-4 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{b.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{b.author}</p>
                            </div>
                          </button>
                        ))
                      )}
                      {!searchingBooks && bookQuery.trim() && bookResults.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-3">검색 결과가 없습니다</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-2 gap-2">
                {!selectedBook && (
                  <button
                    onClick={() => setShowBookSearch(v => !v)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                      showBookSearch ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <BookPlus className="w-3.5 h-3.5" />
                    책 연결
                  </button>
                )}
                {selectedBook && <div />}
                <Button size="sm" onClick={handleSubmitPost} disabled={!newPost.trim() || submitting} className="rounded-xl gap-1.5">
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  게시
                </Button>
              </div>
            </div>
          )}

          {/* Post list */}
          <ScrollArea className="flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center px-6">
                <MessageCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">아직 게시글이 없습니다</p>
                <p className="text-xs text-muted-foreground mt-1">첫 번째 게시글을 남겨보세요!</p>
              </div>
            ) : (
              <div className="p-4 space-y-3 pb-20">
                {posts.map(post => (
                  <PostItem key={post.id} post={post} currentUserId={user?.id} onDelete={handleDeletePost} />
                ))}
              </div>
            )}
          </ScrollArea>
    </div>
  );
};
