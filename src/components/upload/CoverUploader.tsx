import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CoverUploaderProps {
  coverUrl: string;
  userId: string;
  onCoverChange: (url: string) => void;
  disabled?: boolean;
  /** 판매 책은 상태를 눈으로 확인할 수 있어야 하므로 사진이 필수다 */
  required?: boolean;
  /** 제출을 시도했는데 필수 사진이 없을 때만 붉게 경고한다 */
  invalid?: boolean;
}

export const CoverUploader = ({
  coverUrl,
  userId,
  onCoverChange,
  disabled = false,
  required = false,
  invalid = false,
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

      const {
        data: { publicUrl },
      } = supabase.storage.from('book-covers').getPublicUrl(fileName);

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
        whileTap={{ scale: 0.99 }}
        className={`w-full flex items-center gap-3 rounded-[14px] border p-3.5 text-left transition-colors ${
          coverUrl
            ? 'border-primary/40 bg-primary/5'
            : invalid
              ? 'border-destructive border-dashed bg-destructive/5'
              : 'border-dashed border-border bg-card hover:border-primary/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt="내 책 사진"
            className="w-[46px] h-16 object-cover rounded-[4px] shrink-0 shadow-md"
          />
        ) : (
          <div className="w-[46px] h-16 rounded-[4px] bg-muted flex items-center justify-center shrink-0 text-faint">
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              <Camera className="w-5 h-5" />
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
            {coverUrl ? '사진 등록 완료' : isUploading ? '업로드 중…' : '내 책 사진'}
            {!coverUrl && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  required ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}
              >
                {required ? '필수' : '권장'}
              </span>
            )}
          </p>
          <p className="text-[11px] text-faint mt-0.5">
            {coverUrl
              ? '탭하면 다른 사진으로 변경'
              : required
                ? '판매 책은 상태를 확인할 수 있는 사진이 필요해요'
                : '실제 상태가 보이는 사진이면 신뢰도가 올라가요'}
          </p>
        </div>

        {coverUrl && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            className="p-1.5 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </motion.button>

      {invalid && (
        <p className="text-[11px] text-destructive">판매하려면 책 상태 사진을 올려주세요.</p>
      )}
    </div>
  );
};
