import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다');
      return;
    }

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
      toast.success('사진이 업로드되었습니다');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('사진 업로드에 실패했습니다');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    onCoverChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClick = () => {
    if (!disabled && !isUploading) fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      {/* Label */}
      <div className="flex items-center gap-2">
        <Camera className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">내 책 사진</span>
        <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">권장</span>
      </div>
      <p className="text-xs text-muted-foreground">
        실제 책 상태가 보이는 사진을 올리면 대여·거래 신뢰도가 올라갑니다
      </p>

      {/* Upload Zone — always visible */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
        disabled={disabled}
      />

      <motion.button
        type="button"
        onClick={handleClick}
        disabled={disabled || isUploading}
        whileTap={{ scale: 0.98 }}
        className={`
          w-full relative overflow-hidden rounded-2xl border-2 transition-colors
          ${coverUrl
            ? 'border-primary/40 bg-primary/5'
            : 'border-dashed border-border hover:border-primary/50 hover:bg-primary/5 bg-secondary/50'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {coverUrl ? (
          /* Uploaded photo preview */
          <div className="flex items-center gap-4 px-4 py-3">
            <img
              src={coverUrl}
              alt="내 책 사진"
              className="w-16 h-22 object-cover rounded-xl shadow-md flex-shrink-0"
              style={{ height: '88px' }}
            />
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">사진 등록 완료</p>
              <p className="text-xs text-muted-foreground mt-0.5">탭하면 다른 사진으로 변경</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleRemove(); }}
              className="p-1.5 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Empty state — prominent upload CTA */
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            {isUploading ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <ImagePlus className="w-7 h-7 text-primary" />
              </div>
            )}
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">
                {isUploading ? '업로드 중...' : '내 책 상태 사진 추가'}
              </p>
              {!isUploading && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  앞면·뒷면·손상 부위 등 실제 상태를 찍어주세요
                </p>
              )}
            </div>
          </div>
        )}
      </motion.button>
    </div>
  );
};
