import { ReactNode } from 'react';

interface WoodenShelfProps {
  children: ReactNode;
  isEmpty?: boolean;
}

export const WoodenShelf = ({ children, isEmpty = false }: WoodenShelfProps) => {
  return (
    <div className="relative">
      {/* Shelf side panels */}
      <div className="absolute -left-4 top-0 bottom-0 w-4 shelf-side rounded-l-sm z-10" />
      <div className="absolute -right-4 top-0 bottom-0 w-4 shelf-side rounded-r-sm z-10" />
      
      {/* Main shelf area with books */}
      <div className="relative bg-wood-dark/20 min-h-[160px] rounded-sm p-4 pb-0">
        {/* Back panel shadow */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-transparent rounded-sm" />
        
        {/* Books container */}
        <div className="relative z-10 h-[140px] flex items-end">
          {!isEmpty && children}
        </div>
      </div>
      
      {/* Shelf plank */}
      <div className="shelf-plank h-5 rounded-b-sm relative z-20">
        {/* Plank edge highlight */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>
    </div>
  );
};
