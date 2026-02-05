import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, BookOpen, Building2, ArrowLeftRight, Shield, Loader2 } from 'lucide-react';
import { AdminUserManagement } from '@/components/admin/AdminUserManagement';
import { AdminBookManagement } from '@/components/admin/AdminBookManagement';
import { AdminCommunityManagement } from '@/components/admin/AdminCommunityManagement';
import { AdminTransactionMonitoring } from '@/components/admin/AdminTransactionMonitoring';

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

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">관리자 포털</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">사용자</span>
            </TabsTrigger>
            <TabsTrigger value="books" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">도서</span>
            </TabsTrigger>
            <TabsTrigger value="communities" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">커뮤니티</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4" />
              <span className="hidden sm:inline">거래</span>
            </TabsTrigger>
          </TabsList>

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
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPortal;
