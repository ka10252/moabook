import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * 앱 전역 당겨서 새로고침 (window 스크롤 기준).
 *
 * 이 앱은 <main>이 아니라 문서(window) 레벨에서 스크롤된다. 그래서 컨테이너
 * scrollTop 기반 PtR은 홈화면 PWA(브라우저 새로고침 버튼 없음)에서 동작하지 않았다.
 * 여기서는 window.scrollY가 최상단일 때만 아래로 당기는 제스처를 잡아 새로고침한다.
 *  · 스크롤 범위 안: 평소처럼 스크롤
 *  · 최상단에서 더 당김: 임계값 넘으면 새로고침
 * data-ptr-ignore 안(채팅·상세 오버레이 등)에서 시작한 제스처는 무시한다.
 */
const THRESHOLD = 72;

export const PullToRefresh = ({ enabled = true }: { enabled?: boolean }) => {
  const [dist, setDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const active = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const onStart = (e: TouchEvent) => {
      if (!atTop()) { active.current = false; return; }
      const target = e.target as Element | null;
      if (target?.closest('[data-ptr-ignore]')) { active.current = false; return; }
      startY.current = e.touches[0].clientY;
      currentY.current = startY.current;
      active.current = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!active.current) return;
      if (!atTop()) { active.current = false; setDist(0); setDragging(false); return; }
      currentY.current = e.touches[0].clientY;
      const d = currentY.current - startY.current;
      if (d > 0) {
        setDragging(true);
        setDist(Math.min(THRESHOLD * 1.6, d * 0.5));
        if (d > 10) e.preventDefault(); // 최상단 당김 중에만 네이티브 바운스 억제
      } else {
        setDragging(false);
        setDist(0);
      }
    };

    const onEnd = () => {
      if (!active.current) return;
      active.current = false;
      setDragging(false);
      const d = currentY.current - startY.current;
      if (d * 0.5 >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        setDist(44);
        window.location.reload();
        return;
      }
      setDist(0);
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled, refreshing]);

  if (dist <= 0 && !refreshing) return null;
  const ready = refreshing || dist >= THRESHOLD * 0.9;
  return (
    <div
      className="fixed top-14 inset-x-0 z-[60] flex justify-center pointer-events-none"
      style={{
        transform: `translateY(${Math.max(0, dist - 12)}px)`,
        transition: dragging ? 'none' : 'transform 0.2s ease',
      }}
    >
      <div className="mt-1 rounded-full bg-card shadow-md border border-border p-2">
        <Loader2
          className={`w-5 h-5 text-primary ${ready ? 'animate-spin' : ''}`}
          style={ready ? undefined : { transform: `rotate(${dist * 3}deg)` }}
        />
      </div>
    </div>
  );
};
