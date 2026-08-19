import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Images, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { canUseNativeCamera, pickPhoto } from '@/lib/nativePhoto';

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
  const [showSheet, setShowSheet] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 올리는 길은 하나로 모은다 — 웹의 파일 선택도, 앱의 카메라도 결국 Blob 이다.
   * (예전엔 File 만 받아서 카메라를 붙일 자리가 없었다)
   */
  const uploadBlob = async (blob: Blob, ext: string) => {
    if (!userId) return;
    if (!blob.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다');
      return;
    }
    if (blob.size > 5 * 1024 * 1024) {
      toast.error('이미지 크기는 5MB 이하여야 합니다');
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('book-covers')
        .upload(fileName, blob, { upsert: true, contentType: blob.type });

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadBlob(file, file.name.split('.').pop() || 'jpg');
  };

  /** 앱에서만 — 카메라 또는 앨범 */
  const handleNativePick = async (source: 'camera' | 'library') => {
    setShowSheet(false);
    try {
      const blob = await pickPhoto(source);
      if (!blob) return;                                  // 취소
      await uploadBlob(blob, (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg'));
    } catch (err) {
      console.error('camera error:', err);
      toast.error('사진을 가져오지 못했어요. 설정에서 카메라 권한을 확인해주세요.');
    }
  };

  const handleRemove = () => {
    onCoverChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClick = () => {
    if (disabled || isUploading) return;
    // 앱에서는 "찍기 / 앨범"을 먼저 묻는다. 웹의 파일 선택 시트를 그대로 띄우면
    // iOS 가 파일 앱을 먼저 보여줘, 책이 손에 있는데도 찍을 방법이 없다.
    if (canUseNativeCamera) setShowSheet(true);
    else fileInputRef.current?.click();
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
          <p className="text-[15px] font-bold text-foreground flex items-center gap-1.5">
            {coverUrl ? '사진 등록 완료' : isUploading ? '업로드 중…' : '내 책 사진'}
            {!coverUrl && (
              <span
                className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  required ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}
              >
                {required ? '필수' : '권장'}
              </span>
            )}
          </p>
          <p className="text-[13px] text-faint mt-0.5">
            {coverUrl
              ? '탭하면 다른 사진으로 변경'
              : required
                ? '판매 책은 상태를 확인할 수 있는 사진이 필요해요'
                : '상태가 보이면 더 잘 빌려가요'}
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

      {/* 앱에서만 뜨는 선택지. 화면을 덮는 모달 대신 버튼 바로 아래 두 칸으로 —
          누른 자리에서 이어지는 게 손이 덜 간다. */}
      <AnimatePresence>
        {showSheet && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-2 gap-2"
          >
            {([
              { key: 'camera', Icon: Camera, label: '사진 찍기' },
              { key: 'library', Icon: Images, label: '앨범에서 고르기' },
            ] as const).map(({ key, Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleNativePick(key)}
                className="min-h-11 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-medium rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
              >
                <Icon className="w-4 h-4 text-muted-foreground" />
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {invalid && (
        <p className="text-[13px] text-destructive">판매하려면 책 상태 사진을 올려주세요.</p>
      )}
    </div>
  );
};
