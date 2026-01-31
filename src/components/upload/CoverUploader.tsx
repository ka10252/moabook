import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DefaultBookCover } from '@/components/DefaultBookCover';

interface CoverUploaderProps {
  coverUrl: string;
  title: string;
  author: string;
  userId: string;
  onCoverChange: (url: string) => void;
  disabled?: boolean;
}

export const CoverUploader = ({
  coverUrl,
  title,
  author,
  userId,
  onCoverChange,
  disabled = false,
}: CoverUploaderProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('이미지 크기는 5MB 이하여야 합니다');
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('book-covers')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('book-covers')
        .getPublicUrl(fileName);

      onCoverChange(publicUrl);
      toast.success('표지가 업로드되었습니다');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('표지 업로드에 실패했습니다');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    onCoverChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {/* Cover Preview */}
      <div className="flex justify-center">
        <div className="relative">
          {coverUrl ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative"
            >
              <img
                src={coverUrl}
                alt={title || '책 표지'}
                className="w-32 h-44 object-cover rounded-lg shadow-lg"
              />
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground p-1.5 rounded-full shadow-md hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ) : title ? (
            <DefaultBookCover
              title={title}
              author={author}
              className="w-32 h-44"
            />
          ) : null}
        </div>
      </div>

      {/* Upload Button */}
      {title && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || disabled}
            className="gap-2"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            {coverUrl ? '다른 사진으로 변경' : '표지 사진 업로드'}
          </Button>
          <p className="text-xs text-muted-foreground text-center max-w-[250px]">
            책 상태 확인이 가능한 이미지를 업로드해주세요
          </p>
        </motion.div>
      )}
    </div>
  );
};
