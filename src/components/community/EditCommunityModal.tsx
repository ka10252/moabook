import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Community {
  id: string;
  name: string;
  description?: string | null;
  cover_url?: string | null;
}

interface EditCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  community: Community | null;
  onUpdated?: () => void;
}

export const EditCommunityModal = ({
  isOpen,
  onClose,
  community,
  onUpdated,
}: EditCommunityModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (community) {
      setName(community.name);
      setDescription(community.description || '');
      setCoverUrl(community.cover_url || '');
    }
  }, [community]);

  const handleSave = async () => {
    if (!community || !name.trim()) {
      toast.error('커뮤니티 이름을 입력해주세요');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('communities')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          cover_url: coverUrl.trim() || null,
        })
        .eq('id', community.id);

      if (error) throw error;

      toast.success('커뮤니티가 수정되었습니다');
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error('Failed to update community:', err);
      toast.error('커뮤니티 수정에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !community) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-x-4 top-[15%] md:inset-x-auto md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2 z-50"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card rounded-2xl shadow-xl overflow-hidden">
              {/* Header */}
              <header className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h2 className="font-bold text-foreground">커뮤니티 수정</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </header>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Cover Preview */}
                <div className="relative h-32 rounded-xl overflow-hidden bg-muted">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-wood-medium to-wood-dark flex items-center justify-center">
                      <Image className="w-8 h-8 text-white/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30" />
                </div>

                {/* Form */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">커뮤니티 이름 *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="커뮤니티 이름"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">설명</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="커뮤니티에 대한 간단한 설명"
                      className="rounded-xl resize-none"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="coverUrl">커버 이미지 URL</Label>
                    <Input
                      id="coverUrl"
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground">
                      이미지 URL을 입력하면 커뮤니티 카드 배경으로 표시됩니다
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-border flex gap-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 rounded-xl"
                >
                  취소
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="flex-1 rounded-xl gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  저장
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
