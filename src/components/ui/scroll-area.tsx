import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
    {/**
     * ⚠️ 이 ScrollArea 는 **높이가 flex(`flex-1 min-h-0`)에서 나오면 스크롤이 안 될 수 있다.**
     *
     * `h-full`(=height:100%)이 그 높이를 못 물고 viewport 가 내용 높이만큼 자라는 경우가 있다.
     * 그러면 겉 상자(overflow-hidden)가 넘치는 부분을 그냥 잘라내고, 스크롤될 요소가 없다.
     * 알림 팝업에서 겉 상자 634px · viewport 1447px 로 실측했다.
     *
     * `absolute inset-0` 으로 바꿔 한 번에 고치려 했는데, 높이가 확정되지 않은 채로 쓰는
     * 화면(커뮤니티 팝업)에서 내용이 통째로 사라졌다. 그래서 공용 컴포넌트는 그대로 두고
     * **문제가 확인된 화면만 평범한 `overflow-y-auto` div 로 바꾼다.**
     * 새 스크롤 영역을 만들면 `npm run audit:scroll` 로 갇혔는지 확인할 것.
     */}
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">{children}</ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
