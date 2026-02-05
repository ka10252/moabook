import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, 
  Camera, 
  Save, 
  LogOut, 
  Loader2, 
  Eye, 
  EyeOff,
  Lock,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { toast } from 'sonner';

interface ProfilePageProps {
  onSignOut: () => void;
}

export const ProfilePage = ({ onSignOut }: ProfilePageProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdminAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  
  // Profile fields
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState<string>('');
  const [genderPublic, setGenderPublic] = useState(false);
  const [agePublic, setAgePublic] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        const profileData = data as typeof data & {
          bio?: string | null;
          gender?: string | null;
          age?: number | null;
          gender_public?: boolean | null;
          age_public?: boolean | null;
        };
        setNickname(profileData.nickname || '');
        setBio(profileData.bio || '');
        setGender(profileData.gender || '');
        setAge(profileData.age?.toString() || '');
        setGenderPublic(profileData.gender_public || false);
        setAgePublic(profileData.age_public || false);
        setAvatarUrl(profileData.avatar_url);
      }
    } catch (error) {
      console.error('Fetch profile error:', error);
      toast.error('프로필 불러오기에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    if (!nickname.trim()) {
      toast.error('닉네임은 필수입니다');
      return;
    }

    setIsSaving(true);
    try {
      // Check if nickname is unique (case-insensitive, excluding current user)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('nickname', nickname.trim())
        .neq('id', user.id)
        .maybeSingle();

      if (existingProfile) {
        toast.error('이미 존재하는 닉네임입니다.');
        setIsSaving(false);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          nickname: nickname.trim(),
          bio: bio.trim() || null,
          gender: gender || null,
          age: age ? parseInt(age) : null,
          gender_public: genderPublic,
          age_public: agePublic,
        })
        .eq('id', user.id);

      if (error) {
        // Check for unique constraint violation
        if (error.code === '23505') {
          toast.error('이미 존재하는 닉네임입니다.');
          return;
        }
        throw error;
      }

      toast.success('프로필이 저장되었습니다!');
    } catch (error) {
      console.error('Save profile error:', error);
      toast.error('프로필 저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('이미지 크기는 5MB 이하여야 합니다');
      return;
    }

    setIsSaving(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast.success('프로필 사진이 업데이트되었습니다!');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('프로필 사진 업로드에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('비밀번호가 변경되었습니다!');
      setShowPasswordDialog(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Change password error:', error);
      toast.error('비밀번호 변경에 실패했습니다');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOut = () => {
    setShowSignOutDialog(false);
    onSignOut();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full px-4 py-6 pb-24 overflow-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-4 border-background shadow-lg">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-10 h-10 text-primary" />
            )}
          </div>
          <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-primary/90 transition-colors">
            <Camera className="w-4 h-4 text-primary-foreground" />
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </label>
        </div>
        <h1 className="text-2xl font-bold text-foreground mt-4">프로필</h1>
        <p className="text-muted-foreground">계정 설정을 관리하세요</p>
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="space-y-6 max-w-md mx-auto"
      >
        {/* Nickname */}
        <div className="space-y-2">
          <Label htmlFor="nickname">닉네임 *</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="표시될 이름"
            className="h-12 bg-secondary border-border rounded-xl"
          />
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label htmlFor="bio">한 줄 소개</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="자신을 소개해주세요..."
            maxLength={100}
            className="bg-secondary border-border rounded-xl resize-none"
            rows={2}
          />
          <p className="text-xs text-muted-foreground text-right">
            {bio.length}/100
          </p>
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="gender">성별</Label>
            <div className="flex items-center gap-2">
              {genderPublic ? (
                <Eye className="w-4 h-4 text-primary" />
              ) : (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              )}
              <Switch
                checked={genderPublic}
                onCheckedChange={setGenderPublic}
              />
              <span className="text-xs text-muted-foreground">
                {genderPublic ? '공개' : '비공개'}
              </span>
            </div>
          </div>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger className="h-12 bg-secondary border-border rounded-xl">
              <SelectValue placeholder="성별 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">남성</SelectItem>
              <SelectItem value="female">여성</SelectItem>
              <SelectItem value="other">기타</SelectItem>
              <SelectItem value="prefer-not-to-say">밝히지 않음</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Age */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="age">나이</Label>
            <div className="flex items-center gap-2">
              {agePublic ? (
                <Eye className="w-4 h-4 text-primary" />
              ) : (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              )}
              <Switch
                checked={agePublic}
                onCheckedChange={setAgePublic}
              />
              <span className="text-xs text-muted-foreground">
                {agePublic ? '공개' : '비공개'}
              </span>
            </div>
          </div>
          <Input
            id="age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="나이를 입력하세요"
            min={13}
            max={120}
            className="h-12 bg-secondary border-border rounded-xl"
          />
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSaveProfile}
          disabled={isSaving}
          className="w-full h-12 rounded-xl"
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              프로필 저장
            </>
          )}
        </Button>

        {/* Divider */}
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              계정 설정
            </span>
          </div>
        </div>

        {/* Change Password */}
        <Button
          variant="outline"
          onClick={() => setShowPasswordDialog(true)}
          className="w-full h-12 rounded-xl justify-start gap-2"
        >
          <Lock className="w-4 h-4" />
          비밀번호 변경
        </Button>

        {/* Admin Portal - Only visible to admins */}
        {isAdmin && (
          <Button
            variant="outline"
            onClick={() => navigate('/admin-portal')}
            className="w-full h-12 rounded-xl justify-start gap-2 text-primary hover:text-primary hover:bg-primary/10"
          >
            <Shield className="w-4 h-4" />
            관리자 포털
          </Button>
        )}

        {/* Sign Out */}
        <Button
          variant="outline"
          onClick={() => setShowSignOutDialog(true)}
          className="w-full h-12 rounded-xl justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </Button>
      </motion.div>

      {/* Sign Out Dialog */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>로그아웃하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              책장과 커뮤니티에 접근하려면 다시 로그인해야 합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>
              로그아웃
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Change Dialog */}
      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>비밀번호 변경</AlertDialogTitle>
            <AlertDialogDescription>
              새 비밀번호를 입력해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">새 비밀번호</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 입력"
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">비밀번호 확인</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="새 비밀번호 확인"
                className="h-12"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleChangePassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                '비밀번호 변경'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
