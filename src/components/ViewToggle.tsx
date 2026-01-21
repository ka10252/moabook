import { motion } from 'framer-motion';
import { AlignJustify, Grid3X3 } from 'lucide-react';

type ViewMode = 'spine' | 'cover';

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const ViewToggle = ({ viewMode, onViewModeChange }: ViewToggleProps) => {
  return (
    <div className="view-toggle">
      <button
        className={`view-toggle-btn flex items-center gap-2 ${viewMode === 'spine' ? 'active' : ''}`}
        onClick={() => onViewModeChange('spine')}
      >
        <AlignJustify className="w-4 h-4" />
        Spine
      </button>
      <button
        className={`view-toggle-btn flex items-center gap-2 ${viewMode === 'cover' ? 'active' : ''}`}
        onClick={() => onViewModeChange('cover')}
      >
        <Grid3X3 className="w-4 h-4" />
        Cover
      </button>
    </div>
  );
};

export type { ViewMode };
