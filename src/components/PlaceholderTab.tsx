import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface PlaceholderTabProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const PlaceholderTab = ({ icon: Icon, title, description }: PlaceholderTabProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full px-8 text-center"
    >
      <div className="p-6 rounded-3xl bg-muted/50 mb-6">
        <Icon className="w-12 h-12 text-primary" strokeWidth={1.5} />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground max-w-xs">{description}</p>
    </motion.div>
  );
};
