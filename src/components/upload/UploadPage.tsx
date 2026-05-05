import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { UploadBookForm } from './UploadBookForm';
import { ScrollArea } from '@/components/ui/scroll-area';

export const UploadPage = () => {
  return (
    <ScrollArea className="h-full">
      <div className="px-4 py-6 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <p className="eyebrow">Add a book</p>
          <h1 className="font-display text-[28px] font-medium tracking-tight text-foreground mt-1">책 등록하기</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            커뮤니티와 책을 나눠보세요
          </p>
        </motion.div>

        {/* Form */}
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
