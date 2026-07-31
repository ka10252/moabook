import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Search } from 'lucide-react';
import { UploadBookForm } from './UploadBookForm';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

const UPLOAD_TIP_KEY = 'moa_upload_tip_seen';

interface UploadPageProps {
  /** 등록 성공 후 호출 (메인 책장으로 이동) */
  onUploaded?: () => void;
}

export const UploadPage = ({ onUploaded }: UploadPageProps) => {
  // 처음으로 업로드 탭에 들어오면 "제목만 치면 자동완성된다"를 팝업으로 한 번 안내
  const [showTip, setShowTip] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(UPLOAD_TIP_KEY)) setShowTip(true);
  }, []);
  const closeTip = () => { localStorage.setItem(UPLOAD_TIP_KEY, '1'); setShowTip(false); };

  return (
    <ScrollArea className="h-full">
      <div className="px-5 pt-5 pb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <p className="eyebrow">ADD A BOOK</p>
          <h1 className="font-display text-[30px] font-medium leading-none tracking-tight text-foreground mt-1">
            책 등록하기
          </h1>
          <p className="text-xs text-muted-foreground mt-1.5">커뮤니티와 책을 나눠보세요</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <UploadBookForm onUploaded={onUploaded} />
        </motion.div>
      </div>

      {/* 첫 진입 안내 팝업 — 제목 검색 자동완성 */}
      <AnimatePresence>
        {showTip && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/45 backdrop-blur-sm p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeTip}
          >
            <motion.div
              className="w-full max-w-[320px] bg-card rounded-2xl p-6 text-center shadow-xl"
              initial={{ scale: 0.94, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/12 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h2 className="font-display text-[21px] leading-tight text-foreground">
                제목만 입력하면 끝!
              </h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed mt-2.5">
                책 <b className="text-foreground">제목</b>을 입력하고 잠깐 기다리면
                <br />
                표지·저자·소개가 <b className="text-foreground">자동으로</b> 채워져요.
              </p>
              <div className="flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground mt-3 mb-5">
                <Search className="w-3.5 h-3.5 text-primary" />
                자동완성 목록에서 내 책을 고르면 됩니다
              </div>
              <Button onClick={closeTip} className="w-full h-11 rounded-full text-sm font-semibold">
                알겠어요
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ScrollArea>
  );
};
