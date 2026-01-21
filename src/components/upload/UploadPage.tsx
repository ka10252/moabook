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
          <h1 className="text-2xl font-bold text-foreground">Upload a Book</h1>
          <p className="text-muted-foreground mt-1">
            Share your book with the community
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
