import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Camera,
  Save,
  LogOut,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  Shield,
  Globe,
  AlertTriangle,
  Sun,
  Moon,
  MapPin,
  Bell,
  Share,
  Plus,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Send,
  Sparkles,
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
import { useTheme } from '@/hooks/useTheme';
import { usePushNotifications, pushResultMessage } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';
import { CountrySelector } from '@/components/auth/CountrySelector';
import { ALLOWED_COUNTRY } from '@/data/countries';
import { SINGAPORE_DISTRICTS } from '@/data/singaporeDistricts';
import { spineClassFrom } from '@/lib/spineColor';
import { TelegramSettings } from '@/components/profile/TelegramSettings';
import { CharacterEditor } from '@/components/virtual/CharacterEditor';

/** 탈퇴·문의 접수 채널. 자동 탈퇴가 실패해도 이 경로는 항상 열려 있어야 한다. */
const SUPPORT_EMAIL = 'admin@moabook.app';

interface ProfilePageProps {
  onSignOut: () => void;
}

type View = 'overview' | 'edit' | 'notifications' | 'feedback';

/** 의견 분류 — 안 고르면 null로 저장 */
const FEEDBACK_CATEGORIES = [
  { key: 'bug', label: '버그' },
  { key: 'idea', label: '아이디어' },
  { key: 'etc', label: '그 외' },
] as const;

interface Stats {
  registered: number;
  lent: number;
  deals: number;
}

export const ProfilePage = ({ onSignOut }: ProfilePageProps) => {
  const navigate = useNavigate();
  const { user, deleteAccount } = useAuth();
  const { isAdmin } = useAdminAuth();
  const { theme, setTheme } = useTheme();
  const {
    isPushSupported,
    isPushConfigured,
    needsHomeScreenInstall,
    permission,
    isSubscribed,
    loading: pushLoading,
    requestAndSubscribe,
    unsubscribe: unsubscribePush,
  } = usePushNotifications();

  const [view, setView] = useState<View>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteFallback, setShowDeleteFallback] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // 의견 보내기
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState<string | null>(null);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  const submitFeedback = async () => {
    const message = feedbackText.trim();
    if (!message) {
      toast.error('내용을 입력해주세요');
      return;
    }
    if (!user) {
      toast.error('로그인이 필요해요');
      return;
    }
    setSendingFeedback(true);
    const { error } = await supabase.from('feedback').insert({
      user_id: user.id,
      category: feedbackCategory,
      message,
    });
    setSendingFeedback(false);
    if (error) {
      toast.error('전송에 실패했어요. 잠시 후 다시 시도해주세요.');
      return;
    }
    toast.success('잘 전해졌어요, 고마워요 📮');
    setFeedbackText('');
    setFeedbackCategory(null);
    setView('overview');
  };

  // Profile fields
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState<string>('');
  const [genderPublic, setGenderPublic] = useState(false);
  const [agePublic, setAgePublic] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [country, setCountry] = useState('');
  const [district, setDistrict] = useState('');
  const [showRegionBlock, setShowRegionBlock] = useState(false);
  const [stats, setStats] = useState<Stats>({ registered: 0, lent: 0, deals: 0 });

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchStats();
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
          country?: string | null;
          district?: string | null;
        };
        setNickname(profileData.nickname || '');
        setBio(profileData.bio || '');
        setGender(profileData.gender || '');
        setAge(profileData.age?.toString() || '');
        setGenderPublic(profileData.gender_public || false);
        setAgePublic(profileData.age_public || false);
        setAvatarUrl(profileData.avatar_url);
        setCountry(profileData.country || '');
        setDistrict(profileData.district || '');
      }
    } catch (error) {
      console.error('Fetch profile error:', error);
      toast.error('프로필 불러오기에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  /** 숫자는 지어내지 않는다 — 전부 DB 카운트다. */
  const fetchStats = async () => {
    if (!user) return;
    try {
      const [registered, lent, deals] = await Promise.all([
        supabase.from('books').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
        supabase
          .from('books')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user.id)
          .eq('status', 'rented'),
        supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed')
          .or(`owner_id.eq.${user.id},borrower_id.eq.${user.id}`),
      ]);
      setStats({
        registered: registered.count ?? 0,
        lent: lent.count ?? 0,
        deals: deals.count ?? 0,
      });
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    if (!nickname.trim()) {
      toast.error('닉네임은 필수입니다');
      return;
    }

    if (country && country !== ALLOWED_COUNTRY) {
      setShowRegionBlock(true);
      return;
    }

    setIsSaving(true);
    try {
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
          country: country || null,
          district: country === 'SG' ? district || null : null,
        } as Record<string, unknown>)
        .eq('id', user.id);

      if (error) {
        if (error.code === '23505') {
          toast.error('이미 존재하는 닉네임입니다.');
          return;
        }
        throw error;
      }

      toast.success('프로필이 저장되었습니다!');
      setView('overview');
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

    if (file.size > 5 * 1024 * 1024) {
      toast.error('이미지 크기는 5MB 이하여야 합니다');
      return;
    }

    setIsSaving(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

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
      const { error } = await supabase.auth.updateUser({ password: newPassword });
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

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    const { error, unavailable } = await deleteAccount();
    setIsDeletingAccount(false);

    if (!error) {
      setShowDeleteDialog(false);
      toast.success('계정이 삭제되었습니다');
      return;
    }

    // 자동 탈퇴가 불가능하면 유저를 막다른 길에 두지 않고 수동 요청 경로를 연다.
    if (unavailable) {
      setShowDeleteDialog(false);
      setShowDeleteFallback(true);
      return;
    }
    toast.error(error.message);
  };

  const deletionRequestMailto = (() => {
    const subject = encodeURIComponent('[MOA Book] 회원 탈퇴 요청');
    const body = encodeURIComponent(
      `아래 계정의 탈퇴 및 개인정보 삭제를 요청합니다.\n\n` +
        `이메일: ${user?.email ?? ''}\n` +
        `사용자 ID: ${user?.id ?? ''}\n\n` +
        `※ 이 메일은 자동 탈퇴 처리가 일시적으로 불가능하여 발송됩니다.`
    );
    return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-5 pt-5 pb-8">
      <AnimatePresence mode="wait">
        {view === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* 정체성 */}
            <div className="text-center">
              <div className="relative inline-block">
                <div
                  className={`w-[82px] h-[82px] rounded-full flex items-center justify-center overflow-hidden ${
                    avatarUrl ? 'bg-muted' : spineClassFrom(nickname || 'moa')
                  }`}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-display text-[36px] text-spine-text leading-none">
                      {(nickname || '?').charAt(0)}
                    </span>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-md">
                  <Camera className="w-3.5 h-3.5 text-primary-foreground" />
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
              </div>

              <h1 className="font-display text-[28px] font-medium text-foreground mt-3 leading-none">
                {nickname || '이름 없음'}
              </h1>
              {bio && <p className="text-xs text-muted-foreground mt-1.5">{bio}</p>}
              {district && (
                <p className="text-[10.5px] text-faint mt-1.5 flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {district}
                </p>
              )}
            </div>

            {/* 지표 */}
            <div className="flex mt-5 bg-card border border-border rounded-[14px] py-4">
              {[
                { n: stats.registered, l: '등록한 책' },
                { n: stats.lent, l: '빌려줌' },
                { n: stats.deals, l: '거래' },
              ].map((s, i) => (
                <div
                  key={s.l}
                  className={`flex-1 text-center ${i < 2 ? 'border-r border-border' : ''}`}
                >
                  <p className="font-display text-[23px] text-primary leading-none">{s.n}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{s.l}</p>
                </div>
              ))}
            </div>

            {/* 메뉴 */}
            <div className="mt-4">
              <MenuRow icon={User} label="프로필 편집" onClick={() => setView('edit')} />
              <MenuRow icon={Sparkles} label="캐릭터 꾸미기" onClick={() => setCharacterOpen(true)} />
              <MenuRow icon={Bell} label="알림 설정" onClick={() => setView('notifications')} />
              <MenuRow icon={MessageSquare} label="의견 보내기" onClick={() => setView('feedback')} />
              <MenuRow
                icon={theme === 'dark' ? Moon : Sun}
                label={theme === 'dark' ? '다크 모드' : '라이트 모드'}
                trailing={
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                  />
                }
              />
              <MenuRow icon={Lock} label="비밀번호 변경" onClick={() => setShowPasswordDialog(true)} />
              {isAdmin && (
                <MenuRow icon={Shield} label="관리자 포털" onClick={() => navigate('/admin-portal')} />
              )}
              <MenuRow
                icon={LogOut}
                label="로그아웃"
                danger
                onClick={() => setShowSignOutDialog(true)}
              />
            </div>

            <button
              onClick={() => setShowDeleteDialog(true)}
              className="w-full text-center text-[11px] text-faint hover:text-destructive transition-colors mt-6 py-2"
            >
              회원 탈퇴
            </button>
          </motion.div>
        )}

        {view === 'edit' && (
          <motion.div
            key="edit"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <SubHeader title="프로필 편집" onBack={() => setView('overview')} />

            <div className="space-y-5 mt-4">
              {/* 로그인 이메일 — 계정 식별자라 수정 불가, 확인용으로만 보여준다 */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold tracking-wide text-muted-foreground">
                  로그인 이메일
                </Label>
                <Input
                  value={user?.email ?? ''}
                  readOnly
                  disabled
                  className="h-11 text-[13px] bg-muted border-border rounded-xl text-muted-foreground cursor-not-allowed"
                />
                <p className="text-[10px] text-faint">이메일은 변경할 수 없어요.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname" className="text-[10px] font-bold tracking-wide text-muted-foreground">
                  닉네임 *
                </Label>
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="표시될 이름"
                  className="h-11 text-[13px] bg-card border-border rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio" className="text-[10px] font-bold tracking-wide text-muted-foreground">
                  한 줄 소개
                </Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="자신을 소개해주세요…"
                  maxLength={100}
                  className="text-[13px] bg-card border-border rounded-xl resize-none"
                  rows={2}
                />
                <p className="text-[10px] text-faint text-right">{bio.length}/100</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold tracking-wide text-muted-foreground">성별</Label>
                  <div className="flex items-center gap-2">
                    {genderPublic ? (
                      <Eye className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-faint" />
                    )}
                    <Switch checked={genderPublic} onCheckedChange={setGenderPublic} />
                    <span className="text-[10px] text-faint">{genderPublic ? '공개' : '비공개'}</span>
                  </div>
                </div>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className="h-11 text-[13px] bg-card border-border rounded-xl">
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="age" className="text-[10px] font-bold tracking-wide text-muted-foreground">
                    나이
                  </Label>
                  <div className="flex items-center gap-2">
                    {agePublic ? (
                      <Eye className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-faint" />
                    )}
                    <Switch checked={agePublic} onCheckedChange={setAgePublic} />
                    <span className="text-[10px] text-faint">{agePublic ? '공개' : '비공개'}</span>
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
                  className="h-11 text-[13px] bg-card border-border rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  거주 국가
                </Label>
                <CountrySelector
                  value={country}
                  onChange={(val) => {
                    setCountry(val);
                    if (val !== 'SG') setDistrict('');
                  }}
                  className="bg-card border-border"
                />
              </div>

              {country === 'SG' && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    거주 지역
                  </Label>
                  <Select value={district} onValueChange={setDistrict}>
                    <SelectTrigger className="h-11 text-[13px] bg-card border-border rounded-xl">
                      <SelectValue placeholder="지역을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 overflow-y-auto">
                      {SINGAPORE_DISTRICTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-faint">
                    지역을 설정하면 이웃 책장 필터를 사용할 수 있습니다
                  </p>
                </div>
              )}

              <Button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="w-full h-[52px] rounded-xl text-sm font-bold"
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
            </div>
          </motion.div>
        )}

        {view === 'notifications' && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <SubHeader title="알림 설정" onBack={() => setView('overview')} />

            {/* iOS는 홈 화면에 추가하지 않으면 푸시를 아예 못 받으므로, 토글 대신 방법을 알려준다. */}
            <div className="mt-4 rounded-[14px] border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[13px] font-bold text-foreground">
                  <Bell className="w-4 h-4 text-primary" />
                  알림 받기
                </div>
                {!needsHomeScreenInstall &&
                  isPushSupported &&
                  permission !== 'denied' &&
                  (pushLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-faint" />
                  ) : (
                    <Switch
                      checked={isSubscribed}
                      onCheckedChange={async (checked) => {
                        if (!checked) {
                          await unsubscribePush();
                          return;
                        }
                        // 실패하면 왜 실패했는지 그대로 알린다
                        const result = await requestAndSubscribe();
                        if (result === 'granted') toast.success(pushResultMessage(result));
                        else toast.error(pushResultMessage(result));
                      }}
                    />
                  ))}
              </div>

              <ul className="space-y-1 text-[11px] text-muted-foreground">
                <li>· 이웃이 내 책을 빌리고 싶어할 때</li>
                <li>· 빌린 책의 반납일이 다가올 때</li>
                <li>· 채팅 메시지가 도착했을 때</li>
              </ul>

              {needsHomeScreenInstall ? (
                <div className="rounded-xl bg-muted p-3 space-y-1.5">
                  <p className="text-[12px] font-bold text-foreground">
                    iPhone은 홈 화면에 추가해야 알림을 받을 수 있어요
                  </p>
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Share className="w-3 h-3 shrink-0" />
                    Safari 하단 <b className="text-foreground">공유</b> →{' '}
                    <Plus className="w-3 h-3 shrink-0" />
                    <b className="text-foreground">홈 화면에 추가</b>
                  </p>
                  <p className="text-[11px] text-faint">
                    추가한 뒤 홈 화면 아이콘으로 열면 여기서 알림을 켤 수 있습니다.
                  </p>
                </div>
              ) : permission === 'denied' ? (
                <p className="text-[11px] text-destructive">
                  브라우저에서 이 사이트의 알림이 차단돼 있어요. 주소창 왼쪽 자물쇠 → 알림 → 허용으로
                  바꾼 뒤 새로고침해주세요.
                </p>
              ) : !isPushSupported ? (
                <p className="text-[11px] text-muted-foreground">
                  이 브라우저는 알림을 지원하지 않습니다.
                </p>
              ) : !isPushConfigured ? (
                /* 푸시 서버 키(VAPID)가 아직 없다. 켜진 척하면 안 된다. */
                <p className="text-[11px] text-muted-foreground">
                  알림 서버가 아직 준비 중이에요. 정식 배포 후 사용할 수 있습니다.
                </p>
              ) : null}

              {/* 온보딩 외에서도 홈 화면 추가 방법을 언제든 다시 볼 수 있게 — 알림 받기 카드 안 버튼 */}
              <div className="pt-1 border-t border-border">
                <button
                  onClick={() => setShowInstallGuide((v) => !v)}
                  className="w-full flex items-center gap-2 text-[12px] font-semibold text-primary pt-2.5"
                >
                  <Share className="w-3.5 h-3.5" />
                  iPhone 홈 화면에 추가하는 방법
                  <ChevronRight className={`w-3.5 h-3.5 ml-auto transition-transform ${showInstallGuide ? 'rotate-90' : ''}`} />
                </button>
                {showInstallGuide && (
                  <ol className="mt-2.5 space-y-2 text-[12px] text-muted-foreground leading-relaxed">
                    <li>1. Safari 하단 공유 (Share) 버튼을 눌러요</li>
                    <li>2. 홈 화면에 추가 (Add to Home Screen)를 선택해요</li>
                    <li>3. 홈 화면의 MOA Book 아이콘으로 다시 열어요</li>
                    <li>4. 알림 허용 (Allow Notifications)을 누르면 끝!</li>
                  </ol>
                )}
              </div>
            </div>

            <TelegramSettings />
          </motion.div>
        )}

        {view === 'feedback' && (
          <motion.div
            key="feedback"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <SubHeader title="의견 보내기" onBack={() => setView('overview')} />

            <div className="mt-4 space-y-4">
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                바라는 점, 불편한 점, 새 기능 아이디어 — 무엇이든 편하게 들려주세요.
                MOA를 더 좋게 만드는 데 큰 힘이 돼요.
              </p>

              {/* 분류 (선택) */}
              <div className="flex gap-2">
                {FEEDBACK_CATEGORIES.map((c) => {
                  const active = feedbackCategory === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setFeedbackCategory(active ? null : c.key)}
                      className={`flex-1 h-10 rounded-xl text-[13px] font-semibold border transition-colors ${
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>

              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="여기에 자유롭게 적어주세요…"
                rows={6}
                maxLength={1000}
                className="text-[13px] bg-card border-border rounded-xl resize-none"
              />

              <Button
                onClick={submitFeedback}
                disabled={sendingFeedback || !feedbackText.trim()}
                className="w-full h-12 rounded-xl text-[14px] font-bold"
              >
                {sendingFeedback ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    보내기
                  </>
                )}
              </Button>

              <p className="text-[11px] text-faint text-center">
                답장이 필요한 문의는 프로필 하단의 문의 채널을 이용해주세요.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <AlertDialogAction
              onClick={async () => {
                setShowSignOutDialog(false);
                await onSignOut();
                toast.success('로그아웃되었습니다');
                navigate('/', { replace: true });
              }}
            >
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
            <AlertDialogDescription>새 비밀번호를 입력해주세요.</AlertDialogDescription>
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
            <AlertDialogAction onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : '비밀번호 변경'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 탈퇴하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              계정과 모든 데이터(등록한 책, 채팅 기록 등)가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수
              없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : '탈퇴하기'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 자동 탈퇴 실패 시 대체 경로 — 유저가 삭제를 요청할 방법은 항상 열려 있어야 한다 */}
      <AlertDialog open={showDeleteFallback} onOpenChange={setShowDeleteFallback}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>지금은 자동 탈퇴가 어렵습니다</AlertDialogTitle>
            <AlertDialogDescription>
              일시적인 문제로 즉시 탈퇴 처리가 되지 않았습니다. 아래 버튼으로 탈퇴 요청을 보내주시면
              영업일 기준 7일 이내에 계정과 개인정보를 삭제해 드립니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>닫기</AlertDialogCancel>
            <AlertDialogAction asChild>
              <a href={deletionRequestMailto}>탈퇴 요청 메일 보내기</a>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Region Block Popup */}
      <AnimatePresence>
        {showRegionBlock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowRegionBlock(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-[calc(100%-2rem)] max-w-sm bg-card rounded-2xl p-6 shadow-2xl text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-display text-xl font-medium text-foreground mb-2">서비스 이용 불가</h3>
              <p className="text-sm text-muted-foreground mb-6">
                죄송합니다. 아직 해당 지역에서는 서비스 이용이 준비되지 않았습니다.
              </p>
              <Button onClick={() => setShowRegionBlock(false)} className="w-full rounded-xl">
                확인
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 캐릭터(픽셀 아바타) 꾸미기 — 가상공간과 동일 에디터. 프로필에서도 진입 가능하게. */}
      <CharacterEditor
        isOpen={characterOpen}
        onClose={() => setCharacterOpen(false)}
        onSaved={() => { setCharacterOpen(false); toast.success('캐릭터를 저장했어요'); }}
      />
    </div>
  );
};

/* ── 보조 컴포넌트 ─────────────────────────────────────── */

const SubHeader = ({ title, onBack }: { title: string; onBack: () => void }) => (
  <div className="flex items-center gap-2">
    <button
      onClick={onBack}
      className="p-1.5 -ml-1.5 rounded-full text-muted-foreground hover:bg-muted transition-colors"
    >
      <ChevronLeft className="w-5 h-5" />
    </button>
    <h1 className="font-display text-[24px] font-medium text-foreground leading-none">{title}</h1>
  </div>
);

const MenuRow = ({
  icon: Icon,
  label,
  onClick,
  danger,
  trailing,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
}) => {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3.5 px-1 border-b border-border text-left"
    >
      <Icon className={`w-[17px] h-[17px] shrink-0 ${danger ? 'text-destructive' : 'text-muted-foreground'}`} />
      <span
        className={`flex-1 text-[13px] font-semibold ${danger ? 'text-destructive' : 'text-foreground'}`}
      >
        {label}
      </span>
      {trailing ?? <ChevronRight className="w-[15px] h-[15px] text-faint shrink-0" />}
    </Wrapper>
  );
};
