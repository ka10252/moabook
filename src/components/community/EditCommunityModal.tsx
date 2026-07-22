import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image, Loader2, Check, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (community) {
      setName(community.name);
      setDescription(community.description || '');
      setCoverUrl(community.cover_url || '');
      setCoverPreview(community.cover_url || null);
      setCoverFile(null);
    }
  }, [community]);

  const handleCoverFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('이미지 크기는 5MB 이하여야 합니다');
      return;
    }

    setCoverFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!community || !name.trim() || !user) {
      toast.error('커뮤니티 이름을 입력해주세요');
      return;
    }

    setSaving(true);
    try {
      let finalCoverUrl = coverUrl.trim() || null;

      // Upload new cover file if provided
      if (coverFile) {
        const fileExt = coverFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('community-covers')
          .upload(fileName, coverFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('community-covers')
          .getPublicUrl(fileName);

        finalCoverUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from('communities')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          cover_url: finalCoverUrl,
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
        <motion.div
          key="edit-community-backdrop"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Modal */}
          <motion.div
            key="edit-community-modal"
            className="w-[calc(100%-2rem)] max-w-md h-fit box-border"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card rounded-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
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
                {/* Cover Preview with Upload */}
                <div className="space-y-2">
                  <Label>커버 이미지</Label>
                  <div className="relative h-32 rounded-xl overflow-hidden bg-muted group">
                    {coverPreview ? (
                      <img
                        src={coverPreview}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
                        <Image className="w-8 h-8 text-white/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors" />
                    <label className="absolute inset-0 flex items-center justify-center cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload className="w-4 h-4" />
                        <span className="text-sm">이미지 변경</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
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
                    <Label htmlFor="coverUrl">또는 이미지 URL 직접 입력</Label>
                    <Input
                      id="coverUrl"
                      value={coverUrl}
                      onChange={(e) => {
                        setCoverUrl(e.target.value);
                        setCoverPreview(e.target.value || null);
                        setCoverFile(null);
                      }}
                      placeholder="https://example.com/image.jpg"
                      className="rounded-xl"
                    />
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
        </motion.div>
      )}
    </AnimatePresence>
  );
};
