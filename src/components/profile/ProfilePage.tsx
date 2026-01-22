import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Camera, 
  Save, 
  LogOut, 
  Loader2, 
  Eye, 
  EyeOff,
  Lock
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
import { toast } from 'sonner';

interface ProfilePageProps {
  onSignOut: () => void;
}

export const ProfilePage = ({ onSignOut }: ProfilePageProps) => {
  const { user } = useAuth();
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
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    if (!nickname.trim()) {
      toast.error('Nickname is required');
      return;
    }

    setIsSaving(true);
    try {
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

      if (error) throw error;

      toast.success('Profile saved!');
    } catch (error) {
      console.error('Save profile error:', error);
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // For now, show a preview using FileReader (storage bucket not set up)
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarUrl(reader.result as string);
      toast.info('Avatar preview updated. Storage integration coming soon!');
    };
    reader.readAsDataURL(file);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Password changed successfully!');
      setShowPasswordDialog(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Change password error:', error);
      toast.error('Failed to change password');
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
        <h1 className="text-2xl font-bold text-foreground mt-4">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
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
          <Label htmlFor="nickname">Nickname *</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your display name"
            className="h-12 bg-secondary border-border rounded-xl"
          />
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label htmlFor="bio">One-line Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself..."
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
            <Label htmlFor="gender">Gender</Label>
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
                {genderPublic ? 'Public' : 'Private'}
              </span>
            </div>
          </div>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger className="h-12 bg-secondary border-border rounded-xl">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Age */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="age">Age</Label>
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
                {agePublic ? 'Public' : 'Private'}
              </span>
            </div>
          </div>
          <Input
            id="age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Your age"
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
              Save Profile
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
              Account Settings
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
          Change Password
        </Button>

        {/* Sign Out */}
        <Button
          variant="outline"
          onClick={() => setShowSignOutDialog(true)}
          className="w-full h-12 rounded-xl justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </motion.div>

      {/* Sign Out Dialog */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need to sign in again to access your books and communities.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Change Dialog */}
      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Password</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your new password below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="h-12"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleChangePassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Change Password'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
