import { useEffect } from "react";

/**
 * Prevents horizontal trackpad swipes from triggering browser back/forward navigation
 * and inverts vertical scroll direction globally (wheel down → scroll up).
 */
export function usePreventSwipeNavigation() {
  useEffect(() => {
    // Prevent swipe-back navigation via CSS
    document.documentElement.style.overscrollBehaviorX = "none";
    document.body.style.overscrollBehaviorX = "none";

    // Invert vertical scroll direction globally while preserving horizontal trackpad scrolling
    const handleWheel = (e: WheelEvent) => {
      // Keep browser zoom gestures intact
      if (e.ctrlKey || e.metaKey) return;

      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      const isHorizontalGesture = absX > absY;

      // Horizontal gesture: scroll nearest horizontally scrollable ancestor
      if (isHorizontalGesture && absX > 0) {
        let el = e.target as HTMLElement | null;
        while (el && el !== document.documentElement) {
          const style = window.getComputedStyle(el);
          const overflowX = style.overflowX;
          const isScrollableX = overflowX === "auto" || overflowX === "scroll";
          const hasHorizontalScroll = el.scrollWidth > el.clientWidth;

          if (isScrollableX && hasHorizontalScroll) {
            el.scrollLeft += e.deltaX;
            e.preventDefault();
            return;
          }

          el = el.parentElement;
        }

        return;
      }

      // Vertical gesture: invert scroll on nearest vertically scrollable ancestor
      let el = e.target as HTMLElement | null;
      while (el && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const isScrollableY = overflowY === "auto" || overflowY === "scroll";
        const hasVerticalScroll = el.scrollHeight > el.clientHeight;
        if (isScrollableY && hasVerticalScroll) {
          el.scrollTop -= e.deltaY;
          e.preventDefault();
          return;
        }
        el = el.parentElement;
      }

      // Fallback: scroll documentElement
      document.documentElement.scrollTop -= e.deltaY;
      e.preventDefault();
    };

    document.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.removeEventListener("wheel", handleWheel);
      document.documentElement.style.overscrollBehaviorX = "";
      document.body.style.overscrollBehaviorX = "";
    };
  }, []);
}
