import { useRef, useEffect, useState } from 'react';

interface Options {
  onRefresh: () => Promise<void>;
  threshold?: number; // px to pull before triggering
}

export const usePullToRefresh = ({ onRefresh, threshold = 72 }: Options) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startY = 0;
    let currentY = 0;
    let active = false;

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      active = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active) return;
      currentY = e.touches[0].clientY;
      const dist = Math.max(0, currentY - startY);
      if (dist > 0 && el.scrollTop === 0) {
        // Dampen the pull so it feels springy
        const damped = Math.min(threshold * 1.5, dist * 0.45);
        setPullDistance(damped);
        setPulling(damped >= threshold * 0.45);
        if (dist > 10) e.preventDefault();
      }
    };

    const onTouchEnd = async () => {
      if (!active) return;
      active = false;
      const dist = Math.max(0, currentY - startY);
      if (dist * 0.45 >= threshold * 0.45) {
        setPulling(false);
        setRefreshing(true);
        setPullDistance(44);
        await onRefresh();
        setRefreshing(false);
      }
      setPullDistance(0);
      setPulling(false);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh, threshold]);

  return { containerRef, pulling, refreshing, pullDistance };
};
