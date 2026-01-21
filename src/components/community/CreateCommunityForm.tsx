import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CreateCommunityFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const CreateCommunityForm = ({ onSuccess, onCancel }: CreateCommunityFormProps) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Please sign in first');
      return;
    }

    if (!name.trim()) {
      toast.error('Please enter a community name');
      return;
    }

    if (pin.length !== 4) {
      toast.error('Please enter a 4-digit PIN');
      return;
    }

    if (pin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create community with hashed PIN (using simple hash for demo - in production use proper hashing)
      const pinHash = btoa(pin); // Simple encoding for demo

      const { data: community, error: communityError } = await supabase
        .from('communities')
        .insert({
          name: name.trim(),
          pin_hash: pinHash,
          created_by: user.id,
        })
        .select()
        .single();

      if (communityError) throw communityError;

      // Auto-join as admin
      const { error: memberError } = await supabase
        .from('community_members')
        .insert({
          community_id: community.id,
          user_id: user.id,
          role: 'admin',
        });

      if (memberError) throw memberError;

      toast.success(`Community "${name}" created!`);
      onSuccess();
    } catch (error) {
      console.error('Create community error:', error);
      toast.error('Failed to create community');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl mb-3">
          <Plus className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Create Community</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Create a private space for your group
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Community Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., SNU in Paris 2025"
          className="h-12 bg-secondary border-border rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">4-Digit PIN</label>
        <p className="text-xs text-muted-foreground mb-2">
          Members will need this PIN to join
        </p>
        <div className="flex justify-center">
          <InputOTP
            value={pin}
            onChange={setPin}
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
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Confirm PIN</label>
        <div className="flex justify-center">
          <InputOTP
            value={confirmPin}
            onChange={setConfirmPin}
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
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1 h-12 rounded-xl"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !name.trim() || pin.length !== 4}
          className="flex-1 h-12 rounded-xl"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Create'
          )}
        </Button>
      </div>
    </motion.form>
  );
};
