import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, BookOpen, Building2, ArrowLeftRight, Shield, Loader2, Home, Mail, LayoutDashboard, Flag, MessageSquare, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminMetrics } from '@/components/admin/AdminMetrics';
import { AdminUserManagement } from '@/components/admin/AdminUserManagement';
import { AdminBookManagement } from '@/components/admin/AdminBookManagement';
import { AdminCommunityManagement } from '@/components/admin/AdminCommunityManagement';
import { AdminTransactionMonitoring } from '@/components/admin/AdminTransactionMonitoring';
import { AdminAnnouncementManagement } from '@/components/admin/AdminAnnouncementManagement';
import { AdminReportManagement } from '@/components/admin/AdminReportManagement';
import { AdminFeedbackManagement } from '@/components/admin/AdminFeedbackManagement';

const AdminPortal = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
      return;
    }
    if (!adminLoading && !isAdmin) {
      navigate('/');
    }
  }, [user, authLoading, isAdmin, adminLoading, navigate]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border header-safe sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <p className="eyebrow">Admin</p>
              <h1 className="font-display text-[22px] font-medium leading-none tracking-tight text-foreground mt-0.5">
                관리자 포털
              </h1>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">홈으로</span>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid grid-cols-9 w-full max-w-4xl">
            <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">대시보드</span>
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center gap-1.5">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">지표</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1.5">
              <Flag className="w-4 h-4" />
              <span className="hidden sm:inline">신고</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">사용자</span>
            </TabsTrigger>
            <TabsTrigger value="books" className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">도서</span>
            </TabsTrigger>
            <TabsTrigger value="communities" className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">커뮤니티</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-1.5">
              <ArrowLeftRight className="w-4 h-4" />
              <span className="hidden sm:inline">거래</span>
            </TabsTrigger>
            <TabsTrigger value="announcements" className="flex items-center gap-1.5">
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">공지</span>
            </TabsTrigger>
            <TabsTrigger value="feedback" className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">의견</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <AdminDashboard />
          </TabsContent>

          <TabsContent value="metrics">
            <AdminMetrics />
          </TabsContent>

          <TabsContent value="reports">
            <AdminReportManagement />
          </TabsContent>

          <TabsContent value="users">
            <AdminUserManagement />
          </TabsContent>

          <TabsContent value="books">
            <AdminBookManagement />
          </TabsContent>

          <TabsContent value="communities">
            <AdminCommunityManagement />
          </TabsContent>

          <TabsContent value="transactions">
            <AdminTransactionMonitoring />
          </TabsContent>

          <TabsContent value="announcements">
            <AdminAnnouncementManagement />
          </TabsContent>

          <TabsContent value="feedback">
            <AdminFeedbackManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPortal;
