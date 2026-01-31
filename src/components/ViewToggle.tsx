import { motion } from 'framer-motion';
import { AlignJustify, Grid3X3 } from 'lucide-react';

type ViewMode = 'spine' | 'cover';

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const ViewToggle = ({ viewMode, onViewModeChange }: ViewToggleProps) => {
  return (
    <div className="view-toggle min-w-[140px] flex-shrink-0">
      <button
        className={`view-toggle-btn flex items-center gap-1.5 min-w-[65px] justify-center ${viewMode === 'spine' ? 'active' : ''}`}
        onClick={() => onViewModeChange('spine')}
      >
        <AlignJustify className="w-4 h-4 flex-shrink-0" />
        <span className="whitespace-nowrap">책등</span>
      </button>
      <button
        className={`view-toggle-btn flex items-center gap-1.5 min-w-[75px] justify-center ${viewMode === 'cover' ? 'active' : ''}`}
        onClick={() => onViewModeChange('cover')}
      >
        <Grid3X3 className="w-4 h-4 flex-shrink-0" />
        <span className="whitespace-nowrap">북커버</span>
      </button>
    </div>
  );
};

export type { ViewMode };
