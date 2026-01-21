import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type Mode = 'rent' | 'sell';

interface ModeToggleProps {
  value: Mode;
  onChange: (mode: Mode) => void;
}

export const ModeToggle = ({ value, onChange }: ModeToggleProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Transaction Type</label>
      <div className="relative flex p-1 bg-muted rounded-xl">
        <motion.div
          className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-card rounded-lg shadow-sm"
          animate={{ left: value === 'rent' ? '4px' : 'calc(50% + 2px)' }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
        />
        
        <button
          type="button"
          onClick={() => onChange('rent')}
          className={cn(
            "relative flex-1 py-3 text-sm font-semibold rounded-lg transition-colors z-10",
            value === 'rent' ? "text-foreground" : "text-muted-foreground"
          )}
        >
          📖 Rent
        </button>
        
        <button
          type="button"
          onClick={() => onChange('sell')}
          className={cn(
            "relative flex-1 py-3 text-sm font-semibold rounded-lg transition-colors z-10",
            value === 'sell' ? "text-foreground" : "text-muted-foreground"
          )}
        >
          💰 Sell
        </button>
      </div>
    </div>
  );
};
