import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  const [description, setDescription] = useState('');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [requiresPin, setRequiresPin] = useState(true);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

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

    if (requiresPin) {
      if (pin.length !== 4) {
        toast.error('Please enter a 4-digit PIN');
        return;
      }

      if (pin !== confirmPin) {
        toast.error('PINs do not match');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Use a default PIN hash if not requiring PIN (still needed for DB)
      const pinHash = requiresPin ? btoa(pin) : btoa('0000');

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
      className="space-y-5"
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

      {/* Cover Image */}
      <div className="space-y-2">
        <Label>Cover Image (optional)</Label>
        <div className="relative">
          {coverPreview ? (
            <div className="relative h-32 rounded-xl overflow-hidden">
              <img
                src={coverPreview}
                alt="Cover preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setCoverPreview(null)}
                className="absolute top-2 right-2 w-8 h-8 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
              <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Upload cover image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Community Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., SNU in Paris 2025"
          className="h-12 bg-secondary border-border rounded-xl"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Brief Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your community..."
          className="bg-secondary border-border rounded-xl resize-none"
          rows={2}
          maxLength={150}
        />
        <p className="text-xs text-muted-foreground text-right">
          {description.length}/150
        </p>
      </div>

      {/* PIN Toggle */}
      <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
        <div>
          <p className="font-medium text-foreground">Require PIN to join</p>
          <p className="text-xs text-muted-foreground">
            Members will need a 4-digit PIN
          </p>
        </div>
        <Switch
          checked={requiresPin}
          onCheckedChange={setRequiresPin}
        />
      </div>

      {/* PIN Input */}
      {requiresPin && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>4-Digit PIN</Label>
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
            <Label>Confirm PIN</Label>
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
        </motion.div>
      )}

      {/* Actions */}
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
          disabled={isSubmitting || !name.trim() || (requiresPin && pin.length !== 4)}
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
