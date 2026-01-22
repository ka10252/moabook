import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Community {
  id: string;
  name: string;
  member_count: number | null;
}

interface JoinCommunityFormProps {
  community: Community;
  onSuccess: () => void;
  onBack: () => void;
}

export const JoinCommunityForm = ({ community, onSuccess, onBack }: JoinCommunityFormProps) => {
  const { user } = useAuth();
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('먼저 로그인해주세요');
      return;
    }

    if (pin.length !== 4) {
      setError('4자리 PIN을 입력해주세요');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Verify PIN
      const { data: communityData, error: fetchError } = await supabase
        .from('communities')
        .select('pin_hash')
        .eq('id', community.id)
        .single();

      if (fetchError) throw fetchError;

      const enteredPinHash = btoa(pin);
      
      if (communityData.pin_hash !== enteredPinHash) {
        setError('잘못된 PIN입니다. 다시 시도해주세요.');
        setPin('');
        setIsSubmitting(false);
        return;
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('community_members')
        .select('id')
        .eq('community_id', community.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember) {
        toast.info('이미 이 커뮤니티의 멤버입니다');
        onSuccess();
        return;
      }

      // Join community
      const { error: joinError } = await supabase
        .from('community_members')
        .insert({
          community_id: community.id,
          user_id: user.id,
          role: 'member',
        });

      if (joinError) throw joinError;

      toast.success(`"${community.name}"에 가입했습니다!`);
      onSuccess();
    } catch (error) {
      console.error('Join community error:', error);
      toast.error('커뮤니티 가입에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        목록으로 돌아가기
      </button>

      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl mb-3">
          <Users className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">커뮤니티 가입</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {community.name}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {community.member_count || 0}명
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground text-center block">
          4자리 PIN 입력
        </label>
        <p className="text-xs text-muted-foreground text-center mb-4">
          커뮤니티 관리자에게 PIN을 문의하세요
        </p>
        <div className="flex justify-center">
          <InputOTP
            value={pin}
            onChange={(value) => {
              setPin(value);
              setError(null);
            }}
            maxLength={4}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} className="w-14 h-14 text-xl" />
              <InputOTPSlot index={1} className="w-14 h-14 text-xl" />
              <InputOTPSlot index={2} className="w-14 h-14 text-xl" />
              <InputOTPSlot index={3} className="w-14 h-14 text-xl" />
            </InputOTPGroup>
          </InputOTP>
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-destructive text-center mt-2"
          >
            {error}
          </motion.p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || pin.length !== 4}
        className="w-full h-12 rounded-xl"
      >
        {isSubmitting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          '가입하기'
        )}
      </Button>
    </motion.form>
  );
};
