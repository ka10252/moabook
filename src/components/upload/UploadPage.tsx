import { motion } from 'framer-motion';
import { UploadBookForm } from './UploadBookForm';
import { ScrollArea } from '@/components/ui/scroll-area';

export const UploadPage = () => {
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
          <UploadBookForm />
        </motion.div>
      </div>
    </ScrollArea>
  );
};
